package app

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/outbound"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/storage"
)

type OSSRebindOptions struct {
	Endpoint, FromBucket, ToBucket               string
	Apply, BackupConfirmed, MaintenanceConfirmed bool
	CheckToken                                   string
}
type OSSRebindReport struct {
	FromBucket string `json:"fromBucket"`
	ToBucket   string `json:"toBucket"`
	Resources  int    `json:"resources"`
	Checked    int    `json:"checked"`
	Applied    bool   `json:"applied"`
	CheckToken string `json:"checkToken"`
}

type OSSRebindRequest struct {
	FromBucket           string `json:"fromBucket"`
	CheckToken           string `json:"checkToken"`
	BackupConfirmed      bool   `json:"backupConfirmed"`
	MaintenanceConfirmed bool   `json:"maintenanceConfirmed"`
}

// This temporary tool requires one serving backend and a quiet maintenance window.
var ossRebindMu sync.Mutex

func (s *Service) AdminRebindCopiedOSS(ctx context.Context, actor *model.User, req OSSRebindRequest, apply bool) (*OSSRebindReport, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if !ossRebindMu.TryLock() {
		return nil, NewAppError(http.StatusBadRequest, "已有换桶检查或修复正在运行，请等待完成")
	}
	defer ossRebindMu.Unlock()
	if apply && req.CheckToken == "" {
		return nil, NewAppError(http.StatusBadRequest, "请先检查再确认修复")
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	report, err := s.RebindCopiedOSS(ctx, OSSRebindOptions{FromBucket: req.FromBucket, Apply: apply, BackupConfirmed: req.BackupConfirmed, MaintenanceConfirmed: req.MaintenanceConfirmed, CheckToken: req.CheckToken})
	var conflict repository.OSSRebindConflict
	if errors.As(err, &conflict) {
		return report, NewAppError(http.StatusBadRequest, conflict.Error())
	}
	return report, err
}

// RebindCopiedOSS does not change the normal resource resolution policy.
func (s *Service) RebindCopiedOSS(ctx context.Context, opts OSSRebindOptions) (*OSSRebindReport, error) {
	opts.Endpoint = strings.TrimRight(strings.TrimSpace(opts.Endpoint), "/")
	opts.FromBucket = strings.TrimSpace(opts.FromBucket)
	opts.ToBucket = strings.TrimSpace(opts.ToBucket)
	if opts.FromBucket == "" {
		return nil, NewAppError(http.StatusBadRequest, "请填写旧桶名称")
	}
	if opts.Apply && (!opts.BackupConfirmed || !opts.MaintenanceConfirmed) {
		return nil, NewAppError(http.StatusBadRequest, "执行前必须确认已备份数据库，暂停生成、上传和删除，且仅保留当前后端实例")
	}
	report := &OSSRebindReport{FromBucket: opts.FromBucket, ToBucket: opts.ToBucket}
	// Decode/decrypt without the normal settings reader's legacy-secret writeback:
	// even old installations must not receive database updates in preview mode.
	current, err := s.repo.SystemSetting(ossSettingKey)
	if err != nil {
		return report, err
	}
	var value ossSettingValue
	if err := json.Unmarshal([]byte(current.ValueJSON), &value); err != nil {
		return report, NewAppError(http.StatusBadRequest, "平台存储配置无效")
	}
	if _, err := s.decryptOSSSettingSecrets(&value); err != nil {
		return report, NewAppError(http.StatusBadRequest, "无法解密平台存储配置，请检查原数据目录和密钥")
	}
	value = normalizeOSSSetting(value)
	if opts.Endpoint == "" {
		opts.Endpoint = value.Endpoint
	}
	if opts.ToBucket == "" {
		opts.ToBucket = value.Bucket
	}
	report.ToBucket = opts.ToBucket
	if opts.FromBucket == opts.ToBucket {
		return report, NewAppError(http.StatusBadRequest, "旧桶不能与当前平台桶相同")
	}
	if !value.Enabled || value.Provider != "aliyun" || value.Endpoint != opts.Endpoint || value.Bucket != opts.ToBucket || value.AccessKeyID == "" || value.AccessKeySecret == "" {
		return report, NewAppError(http.StatusBadRequest, "请先在后台保存并启用新桶的阿里云平台存储配置")
	}
	location, err := s.repo.StorageLocationByDigest("platform", "", "aliyun", storageLocationDigest(value))
	if err != nil {
		return report, NewAppError(http.StatusBadRequest, "未找到已保存的目标存储位置，请在后台重新保存平台 OSS 配置")
	}
	_, target, err := s.storageLocationValue(location.ID)
	if err != nil {
		return report, NewAppError(http.StatusBadRequest, "无法读取目标存储配置")
	}
	if target.Bucket != value.Bucket || target.Endpoint != value.Endpoint || target.AccessKeyID != value.AccessKeyID || target.AccessKeySecret != value.AccessKeySecret {
		return report, NewAppError(http.StatusBadRequest, "目标位置与当前平台凭据不一致，请在后台重新保存配置")
	}
	resources, err := s.repo.OSSRebindResources(opts.Endpoint, opts.FromBucket)
	if err != nil {
		return report, err
	}
	report.Resources = len(resources)
	snapshot, err := json.Marshal([]any{resources, location, current})
	if err != nil {
		return report, err
	}
	report.CheckToken = fmt.Sprintf("%x", sha256.Sum256(snapshot))
	if opts.Apply && opts.CheckToken != "" && opts.CheckToken != report.CheckToken {
		return report, NewAppError(http.StatusBadRequest, "资源或存储配置已变化，请重新检查")
	}
	if len(resources) == 0 {
		return report, nil
	}
	if err := s.repo.CheckOSSRebindConflicts(opts.Endpoint, opts.FromBucket, opts.ToBucket, resources); err != nil {
		return report, err
	}
	for _, resource := range resources {
		if err := validateOSSRebindResource(resource); err != nil {
			return report, NewAppError(http.StatusBadRequest, fmt.Sprintf("资源 %s：%s；整批停止，未修改任何资源绑定", resource.ID, err))
		}
		if err := checkOSSRebindObject(ctx, target, resource.ObjectKey, resource.Size); err != nil {
			return report, NewAppError(http.StatusBadRequest, fmt.Sprintf("资源 %s：%s；未修改任何资源绑定", resource.ID, err))
		}
		report.Checked++
	}
	if opts.Apply {
		if err := ctx.Err(); err != nil {
			return report, err
		}
		if err := s.repo.WithContext(ctx).ApplyOSSRebind(opts.Endpoint, opts.FromBucket, opts.ToBucket, resources, *location, *current); err != nil {
			return report, err
		}
		report.Applied = true
	}
	return report, nil
}

func validateOSSRebindResource(resource model.Resource) error {
	switch {
	case resource.Status != model.ResourceStatusReady:
		return fmt.Errorf("原文件尚未就绪（状态 %q）", resource.Status)
	case strings.TrimSpace(resource.ObjectKey) == "":
		return errors.New("原文件对象路径为空")
	case resource.Size <= 0:
		return fmt.Errorf("原文件大小无效（%d 字节）", resource.Size)
	case resource.PlaybackStatus == model.PlaybackStatusProcessing:
		return errors.New("视频播放版本正在处理，请等待处理结束后重新检查")
	case resource.ThumbnailStatus == "processing":
		return errors.New("缩略图正在处理，请等待处理结束后重新检查")
	case resource.PlaybackStatus == model.PlaybackStatusReady && strings.TrimSpace(resource.PlaybackObjectKey) == "":
		return errors.New("视频播放版本已就绪但文件路径为空，请先核对资源记录")
	case resource.ThumbnailStatus == "ready" && resource.ThumbnailSize <= 0:
		return errors.New("缩略图已就绪但文件大小无效，请先核对资源记录")
	}
	// Playback copies are local-only; thumbnail access currently falls back to
	// the original. Preserve derivative metadata, without inventing OSS keys.
	return nil
}

func checkOSSRebindObject(ctx context.Context, value ossSettingValue, key string, size int64) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := storage.NewOSSRequest(http.MethodHead, value, key, "", nil)
	if err != nil {
		return errors.New("目标地址无效")
	}
	resp, err := outbound.OutboundHTTPClient(10 * time.Second).Do(req.WithContext(ctx))
	if err != nil {
		return errors.New("目标文件检查失败，请检查网络及访问权限")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("目标文件读取失败（HTTP %d）", resp.StatusCode)
	}
	if resp.ContentLength != size {
		return fmt.Errorf("文件大小不一致，记录 %d 字节、目标 %d 字节", size, resp.ContentLength)
	}
	return nil
}
