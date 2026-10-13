package app

import (
	"fmt"
	"regexp"
	"strings"
)

var youchuanPromptParameter = regexp.MustCompile(`--[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[0-9]+(?:\.[0-9]+)?)?`)

func validateYouchuanPromptParameters(wire, prompt string) error {
	if (wire != "youchuan-image" && wire != "runninghub-youchuan-image") || !strings.Contains(prompt, "--") {
		return nil
	}
	// Only echo parameter names and numeric values, never arbitrary prompt text or reference URLs.
	parameters := youchuanPromptParameter.FindAllString(prompt, 6)
	if len(parameters) == 0 {
		parameters = []string{"--"}
	}
	more := len(parameters) > 5
	if more {
		parameters = parameters[:5]
	}
	for i, parameter := range parameters {
		if len(parameter) > 48 {
			parameter = parameter[:48] + "…"
		}
		parameters[i] = "「" + parameter + "」"
	}
	details := strings.Join(parameters, "、")
	if more {
		details += "等"
	}
	return fmt.Errorf("提示词包含手写模型参数：%s。请从提示词中移除，并通过模型选择和高级设置调整。", details)
}
