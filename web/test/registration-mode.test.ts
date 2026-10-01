import { expect, test } from "bun:test";

test("registration mode keeps code and email-only flows distinct", async () => {
    const [registerSource, settingsSource, apiSource, emailSettingsSource] = await Promise.all([
        Bun.file(new URL("../src/pages/auth/register.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/pages/admin/components/access-settings-panel.tsx", import.meta.url)).text(),
        Bun.file(new URL("../src/services/api/wallet.ts", import.meta.url)).text(),
        Bun.file(new URL("../src/pages/admin/components/email-settings-panel.tsx", import.meta.url)).text(),
    ]);

    expect(apiSource).toContain('export type RegistrationMode = "email_code" | "email_only"');
    expect(apiSource).toContain('mode: result.setting.mode || "email_code"');
    expect(registerSource).toContain("settings?.emailCodeRequired");
    expect(registerSource).toContain('<VerificationFields purpose="register" method="email"');
    expect(registerSource).toContain('type="email"');
    expect(registerSource).not.toContain('label="显示名称"');
    expect(registerSource).not.toContain("displayName,");
    expect(settingsSource).toContain('value: "email_code", label: "邮箱验证码（推荐）"');
    expect(settingsSource).toContain('value: "email_only", label: "仅邮箱（不验证）"');
    expect(settingsSource).toContain("邮箱不会被标记为已验证");
    expect(settingsSource).toContain("savingRegistration || savingAgreement");
    expect(emailSettingsSource).toContain("仅邮箱注册不依赖此开关");
});
