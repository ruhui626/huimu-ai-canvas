package repository

import (
	"reflect"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"yingce/backend/internal/model"
)

type OSSRebindConflict string

func (e OSSRebindConflict) Error() string { return string(e) }

// Only used by the temporary administrator repair, never by resource reads.
func (r *Repository) OSSRebindResources(endpoint, from string) ([]model.Resource, error) {
	items := []model.Resource{}
	err := r.db.Where("provider = ? AND endpoint = ? AND bucket = ?", "aliyun", endpoint, from).Order("id").Find(&items).Error
	if err != nil {
		return nil, err
	}
	var ambiguous int64
	err = r.db.Model(&model.Resource{}).Where("provider = ? AND endpoint = ? AND bucket = ?", "aliyun", endpoint, from).
		Where(`NOT (COALESCE(storage_setting_id, '') IN (SELECT id FROM storage_locations WHERE scope = 'platform' AND owner_id = '') OR
		(COALESCE(storage_setting_id, '') = '' AND NOT EXISTS (SELECT 1 FROM user_oss_settings u WHERE u.user_id = resources.user_id)))`).Count(&ambiguous).Error
	if err != nil {
		return nil, err
	}
	if ambiguous != 0 {
		return nil, OSSRebindConflict("旧桶包含个人存储或归属不明确的资源，已停止；请人工核对，不自动混合迁移")
	}
	return items, nil
}

func (r *Repository) CheckOSSRebindConflicts(endpoint, from, to string, resources []model.Resource) error {
	var count int64
	if err := r.db.Model(&model.ResourceDeletionJob{}).Where("provider = ? AND endpoint = ? AND bucket IN ?", "aliyun", endpoint, []string{from, to}).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return OSSRebindConflict("源桶或目标桶存在物理删除任务，已停止；请先人工核对")
	}
	for _, resource := range resources {
		if err := r.db.Model(&model.Resource{}).Where("provider = ? AND endpoint = ? AND bucket = ? AND object_key = ?", "aliyun", endpoint, to, resource.ObjectKey).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return OSSRebindConflict("目标桶已有相同路径的资源记录，已停止；请人工核对是否重复")
		}
	}
	return nil
}

func (r *Repository) ApplyOSSRebind(endpoint, from, to string, checked []model.Resource, location model.StorageLocation, current model.SystemSetting) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// The explicit maintenance window prevents writes from other backend/worker
		// processes. Locks and snapshot checks also reject stale preflight results.
		var savedLocation model.StorageLocation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&savedLocation, "id = ?", location.ID).Error; err != nil {
			return err
		}
		var savedSetting model.SystemSetting
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&savedSetting, "key = ?", current.Key).Error; err != nil {
			return err
		}
		if savedLocation.ValueJSON != location.ValueJSON || savedLocation.Scope != "platform" || savedLocation.OwnerID != "" || savedSetting.ValueJSON != current.ValueJSON {
			return OSSRebindConflict("存储配置在检查后发生变化，未执行迁移")
		}
		var locked []model.Resource
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("provider = ? AND endpoint = ? AND bucket = ?", "aliyun", endpoint, from).Order("id").Find(&locked).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(locked, checked) {
			return OSSRebindConflict("资源在检查后发生变化，未执行迁移")
		}
		repo := New(tx)
		if _, err := repo.OSSRebindResources(endpoint, from); err != nil {
			return err
		}
		if err := repo.CheckOSSRebindConflicts(endpoint, from, to, checked); err != nil {
			return err
		}
		for _, resource := range checked {
			result := tx.Model(&model.Resource{}).Where("id = ? AND updated_at = ? AND bucket = ?", resource.ID, resource.UpdatedAt, from).
				Updates(map[string]any{"bucket": to, "storage_setting_id": location.ID, "public_url": "", "updated_at": time.Now().UTC()})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return OSSRebindConflict("资源更新数量不一致，整批回滚")
			}
		}
		return nil
	})
}
