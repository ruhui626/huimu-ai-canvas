package outbound

import (
	"net/http"
	"testing"
	"time"
)

func TestChannelProxyKeepsRedirectCredentialBoundary(t *testing.T) {
	for _, proxy := range []string{"", "http://127.0.0.1:1080", "socks5://127.0.0.1:1080"} {
		t.Run(proxy, func(t *testing.T) {
			client := OutboundHTTPClientWithProxy(time.Second, proxy)
			first, _ := http.NewRequest(http.MethodGet, "https://8.8.8.8/source", nil)
			for _, target := range []string{"https://8.8.8.8/same", "https://1.1.1.1/other", "http://8.8.8.8/downgrade"} {
				next, _ := http.NewRequest(http.MethodGet, target, nil)
				next.Header.Set("x-youchuan-app", "test-app")
				next.Header.Set("x-youchuan-secret", "test-secret")
				if err := client.CheckRedirect(next, []*http.Request{first}); err != nil {
					t.Fatal(err)
				}
				sameOrigin := target == "https://8.8.8.8/same"
				if (next.Header.Get("x-youchuan-app") != "") != sameOrigin || (next.Header.Get("x-youchuan-secret") != "") != sameOrigin {
					t.Fatalf("incorrect credential forwarding for %s", target)
				}
			}
		})
	}
}
