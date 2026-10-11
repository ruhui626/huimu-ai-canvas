package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"yingce/backend/internal/service"
)

func registerOSSRebindRoutes(r *gin.RouterGroup, svc *service.Service) {
	for _, action := range []string{"check", "apply"} {
		apply := action == "apply"
		r.POST("/admin/settings/oss/rebind/"+action, func(c *gin.Context) {
			user, err := currentUser(c, svc)
			if err != nil {
				failService(c, err)
				return
			}
			if !enforceRateLimit(c, "oss-rebind:"+user.ID, 6, time.Minute) {
				return
			}
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
			var req service.OSSRebindRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				fail(c, http.StatusBadRequest, err)
				return
			}
			result, err := svc.AdminRebindCopiedOSS(c.Request.Context(), user, req, apply)
			if err != nil {
				failService(c, err)
				return
			}
			ok(c, result)
		})
	}
}
