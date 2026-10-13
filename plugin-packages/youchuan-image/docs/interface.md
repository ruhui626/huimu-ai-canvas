# 悠船图片 接口字段

## 协议身份

- 插件 ID：`youchuan-image`。
- Provider ID：`youchuan-image`。
- 能力：`image`。
- 默认 Base URL：`https://ali.youchuan.cn`。
- 鉴权驱动：`youchuan`。
- 创建：`POST /v1/tob/diffusion`。
- 查询：`GET /v1/tob/job/{{taskId}}`。

## 配置字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | 机构标识（x-youchuan-app） |
| `secretKey` | secret | 是 | 机构授权码（x-youchuan-secret） |

## 统一字段映射

| 统一字段 | 类型 | 必填 | 上游映射 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | `text: --v / --niji` | v8.1、v8.2、v7、niji-7；不是上游 JSON model 字段。 |
| `providerOptions` | object | 否 | `text: --stylize / --weird / --chaos` | youchuan-image 命名空间：stylize 0–1000 默认100，weird 0–3000 平台默认50，chaos 0–100 平台默认5，均为整数。 |
| `prompt` | string | 是 | `text` | 自然语言提示词，最多 1024 字；第一阶段不允许手写 -- 参数。 |
| `images` | media[] | 否 | `text 前置 URL` | 最多 20 张普通 HTTPS 参考图，不支持蒙版、角色或风格专用引用。 |
| `aspectRatio` | string | 否 | `text: --ar` | 画面比例，默认 1:1。 |
| `imageCount` | integer | 否 | `一次标准任务` | 只能提交一组，通常返回四张；全部保存，按一次任务计费。 |

## 上游请求模板逐字段清单

下表由插件请求模板生成，覆盖 body、query、headers 和 multipart 文件声明中的每个字段。

| 上游位置 | 值或转换表达式 |
| --- | --- |
| `create.method` | `"POST"` |
| `create.path` | `"/v1/tob/diffusion"` |
| `create.contentType` | `"application/json"` |
| `create.body.text` | `{"$concat":[{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},0]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},0]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},1]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},1]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},2]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},2]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},3]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},3]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},4]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},4]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},5]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},5]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},6]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},6]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},7]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},7]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},8]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},8]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},9]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},9]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},10]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},10]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},11]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},11]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},12]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},12]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},13]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},13]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},14]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},14]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},15]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},15]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},16]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},16]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},17]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},17]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},18]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},18]}," "]},"else":""}},{"$if":{"condition":{"$gt":[{"$len":{"$ref":"request.images"}},19]},"then":{"$concat":[{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},19]}," "]},"else":""}},{"$trim":{"$ref":"request.prompt"}},{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"niji-7"]},"then":" --niji 7","else":{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"v7"]},"then":" --v 7","else":{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"v8.1"]},"then":" --v 8.1","else":" --v 8.2"}}}}}}," --fast --ar ",{"$coalesce":[{"$ref":"request.aspectRatio"},"1:1"]}," --stylize ",{"$coalesce":[{"$ref":"request.providerOptions.youchuan-image.stylize"},100]}," --weird ",{"$coalesce":[{"$ref":"request.providerOptions.youchuan-image.weird"},50]}," --chaos ",{"$coalesce":[{"$ref":"request.providerOptions.youchuan-image.chaos"},5]}]}` |
| `poll.method` | `"GET"` |
| `poll.path` | `"/v1/tob/job/{{taskId}}"` |
| `poll.contentType` | `"application/json"` |

## Provider 扩展键

- `providerOptions.youchuan-image.chaos`
- `providerOptions.youchuan-image.stylize`
- `providerOptions.youchuan-image.weird`

动态模型或工作流允许使用文档声明的完整 `parameters/input/extra_body` 对象；该对象是协议本身的开放 schema，不会被宿主裁剪。

## 响应映射逐字段清单

| 映射位置 | 上游路径或转换表达式 |
| --- | --- |
| `response.taskId` | `{"$coalesce":[{"$ref":"response.id"},{"$ref":"taskId"}]}` |
| `response.status` | `{"$if":{"condition":{"$eq":[{"$ref":"response.status"},1]},"then":"processing","else":{"$if":{"condition":{"$eq":[{"$ref":"response.status"},2]},"then":"succeeded","else":"failed"}}}}` |
| `response.message` | `{"$coalesce":[{"$ref":"response.message"},{"$ref":"response.comment"},"悠船返回未知状态"]}` |
| `response.errorPaths[0]` | `"code"` |
| `response.resultEphemeral` | `true` |
| `response.images` | `{"$if":{"condition":{"$and":[{"$eq":[{"$ref":"response.status"},2]},{"$lte":[{"$len":{"$ref":"response.urls"}},4]}]},"then":{"$map":{"from":{"$ref":"response.urls"},"as":"image","in":{"url":{"$if":{"condition":{"$not":{"$at":[{"$ref":"response.audits"},{"$ref":"imageIndex"}]}},"then":{"$ref":"image"},"else":null}},"id":{"$coalesce":[{"$ref":"response.id"},{"$ref":"taskId"}]},"order":{"$ref":"imageIndex"}}}},"else":[]}}` |
| `response.usage.audits` | `{"$ref":"response.audits"}` |
| `response.usage.feeCost` | `{"$ref":"response.cost.feeCost"}` |

## 响应与错误

插件把上游 task/status/text/media/usage 映射为统一结果。临时媒体 URL 标记为 ephemeral，由宿主立即下载持久化。HTTP 错误、业务 code 和 error object 保持失败语义，不包装成成功。

## 兼容边界

第一阶段仅标准快速生图与普通参考图；一次任务通常四张，配置按次价格（整组），不按图片张数重复收费。API Key 填机构标识、Secret Key 填机构授权码。不开放手写 -- 参数、高清、草图、极速、指令编辑或视频。部分审核失败只保存通过审核的图片，保留原始序号；全部为空则报错。图片结果只保留 30 天，须保存到本站。下载仅对配置的同源地址发送授权，跨域使用上游已授权 URL，不向第三方泄露机构授权码；真实账号的文件下载方式仍需联调确认。官方文档：https://tob.youchuan.cn/docs/guides/quickstart ，https://tob.youchuan.cn/docs/price 。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "youchuan-image",
  "name": "悠船图片",
  "version": "2.1.0",
  "author": "悠船 / 绘幕",
  "description": "悠船图片 独立请求协议插件。",
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "机构标识（x-youchuan-app）",
        "required": true
      },
      {
        "name": "secretKey",
        "type": "secret",
        "label": "机构授权码（x-youchuan-secret）",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "youchuan-image",
        "label": "悠船图片",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://ali.youchuan.cn",
        "requiresPublicMediaUrls": true,
        "auth": {
          "type": "youchuan",
          "field": "apiKey",
          "secretField": "secretKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "text: --v / --niji",
            "description": "v8.1、v8.2、v7、niji-7；不是上游 JSON model 字段。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "text: --stylize / --weird / --chaos",
            "description": "youchuan-image 命名空间：stylize 0–1000 默认100，weird 0–3000 平台默认50，chaos 0–100 平台默认5，均为整数。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "text",
            "description": "自然语言提示词，最多 1024 字；第一阶段不允许手写 -- 参数。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "text 前置 URL",
            "description": "最多 20 张普通 HTTPS 参考图，不支持蒙版、角色或风格专用引用。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "text: --ar",
            "description": "画面比例，默认 1:1。"
          },
          {
            "name": "imageCount",
            "type": "integer",
            "required": false,
            "mapping": "一次标准任务",
            "description": "只能提交一组，通常返回四张；全部保存，按一次任务计费。"
          }
        ],
        "validations": [
          {
            "assert": {
              "$in": [
                {
                  "$ref": "request.model"
                },
                [
                  "v8.1",
                  "v8.2",
                  "v7",
                  "niji-7"
                ]
              ]
            },
            "message": "悠船模型名仅支持 v8.1、v8.2、v7、niji-7。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.stylize"
                        },
                        100
                      ]
                    },
                    0
                  ]
                },
                {
                  "$lte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.stylize"
                        },
                        100
                      ]
                    },
                    1000
                  ]
                },
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.stylize"
                        },
                        100
                      ]
                    },
                    {
                      "$toInt": {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.stylize"
                          },
                          100
                        ]
                      }
                    }
                  ]
                }
              ]
            },
            "message": "悠船 stylize 必须为 0 到 1000 的整数。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.weird"
                        },
                        50
                      ]
                    },
                    0
                  ]
                },
                {
                  "$lte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.weird"
                        },
                        50
                      ]
                    },
                    3000
                  ]
                },
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.weird"
                        },
                        50
                      ]
                    },
                    {
                      "$toInt": {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.weird"
                          },
                          50
                        ]
                      }
                    }
                  ]
                }
              ]
            },
            "message": "悠船 weird 必须为 0 到 3000 的整数。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.chaos"
                        },
                        5
                      ]
                    },
                    0
                  ]
                },
                {
                  "$lte": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.chaos"
                        },
                        5
                      ]
                    },
                    100
                  ]
                },
                {
                  "$eq": [
                    {
                      "$coalesce": [
                        {
                          "$ref": "request.providerOptions.youchuan-image.chaos"
                        },
                        5
                      ]
                    },
                    {
                      "$toInt": {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.chaos"
                          },
                          5
                        ]
                      }
                    }
                  ]
                }
              ]
            },
            "message": "悠船 chaos 必须为 0 到 100 的整数。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$ref": "request.imageCount"
                    },
                    0
                  ]
                },
                {
                  "$lte": [
                    {
                      "$ref": "request.imageCount"
                    },
                    1
                  ]
                }
              ]
            },
            "message": "悠船一次提交一组（通常四张），不能重复批量提交。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gt": [
                    {
                      "$len": {
                        "$trim": {
                          "$ref": "request.prompt"
                        }
                      }
                    },
                    0
                  ]
                },
                {
                  "$lte": [
                    {
                      "$len": {
                        "$ref": "request.prompt"
                      }
                    },
                    1024
                  ]
                }
              ]
            },
            "message": "悠船提示词须为 1 到 1024 字符。"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$split": [
                      {
                        "$ref": "request.prompt"
                      },
                      "--"
                    ]
                  }
                },
                1
              ]
            },
            "message": "悠船第一阶段不支持手写 -- 参数，请通过模型与比例设置选择；暂不开放高清、草图或极速模式。"
          },
          {
            "assert": {
              "$in": [
                {
                  "$coalesce": [
                    {
                      "$ref": "request.aspectRatio"
                    },
                    "1:1"
                  ]
                },
                [
                  "1:1",
                  "3:2",
                  "2:3",
                  "4:3",
                  "3:4",
                  "4:5",
                  "5:4",
                  "16:9",
                  "9:16",
                  "21:9"
                ]
              ]
            },
            "message": "悠船当前比例不受支持，请重新选择画面比例。"
          },
          {
            "assert": {
              "$and": [
                {
                  "$lte": [
                    {
                      "$len": {
                        "$ref": "request.images"
                      }
                    },
                    20
                  ]
                },
                {
                  "$eq": [
                    {
                      "$len": {
                        "$ref": "request.videos"
                      }
                    },
                    0
                  ]
                },
                {
                  "$eq": [
                    {
                      "$len": {
                        "$ref": "request.audios"
                      }
                    },
                    0
                  ]
                }
              ]
            },
            "message": "悠船图片仅支持最多 20 张参考图，不支持视频或音频输入。"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$filter": {
                      "from": {
                        "$ref": "request.images"
                      },
                      "as": "media",
                      "where": {
                        "$not": {
                          "$and": [
                            {
                              "$eq": [
                                {
                                  "$first": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      ":"
                                    ]
                                  }
                                },
                                "https"
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      " "
                                    ]
                                  }
                                },
                                1
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      "\n"
                                    ]
                                  }
                                },
                                1
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      "\r"
                                    ]
                                  }
                                },
                                1
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      "\t"
                                    ]
                                  }
                                },
                                1
                              ]
                            },
                            {
                              "$eq": [
                                {
                                  "$len": {
                                    "$split": [
                                      {
                                        "$ref": "media.value"
                                      },
                                      "--"
                                    ]
                                  }
                                },
                                1
                              ]
                            },
                            {
                              "$in": [
                                {
                                  "$coalesce": [
                                    {
                                      "$ref": "media.role"
                                    },
                                    "reference_image"
                                  ]
                                },
                                [
                                  "reference_image",
                                  "edit_source"
                                ]
                              ]
                            }
                          ]
                        }
                      }
                    }
                  }
                },
                0
              ]
            },
            "message": "悠船仅支持普通 HTTPS 参考图，地址不能包含空白或 -- 参数，不支持蒙版及专用引用。"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$concat": [
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              0
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  0
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              1
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  1
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              2
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  2
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              3
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  3
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              4
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  4
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              5
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  5
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              6
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  6
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              7
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  7
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              8
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  8
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              9
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  9
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              10
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  10
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              11
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  11
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              12
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  12
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              13
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  13
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              14
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  14
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              15
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  15
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              16
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  16
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              17
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  17
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              18
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  18
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$gt": [
                              {
                                "$len": {
                                  "$ref": "request.images"
                                }
                              },
                              19
                            ]
                          },
                          "then": {
                            "$concat": [
                              {
                                "$at": [
                                  {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  },
                                  19
                                ]
                              },
                              " "
                            ]
                          },
                          "else": ""
                        }
                      },
                      {
                        "$trim": {
                          "$ref": "request.prompt"
                        }
                      },
                      {
                        "$if": {
                          "condition": {
                            "$eq": [
                              {
                                "$ref": "request.model"
                              },
                              "niji-7"
                            ]
                          },
                          "then": " --niji 7",
                          "else": {
                            "$if": {
                              "condition": {
                                "$eq": [
                                  {
                                    "$ref": "request.model"
                                  },
                                  "v7"
                                ]
                              },
                              "then": " --v 7",
                              "else": {
                                "$if": {
                                  "condition": {
                                    "$eq": [
                                      {
                                        "$ref": "request.model"
                                      },
                                      "v8.1"
                                    ]
                                  },
                                  "then": " --v 8.1",
                                  "else": " --v 8.2"
                                }
                              }
                            }
                          }
                        }
                      },
                      " --fast --ar ",
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.aspectRatio"
                          },
                          "1:1"
                        ]
                      },
                      " --stylize ",
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.stylize"
                          },
                          100
                        ]
                      },
                      " --weird ",
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.weird"
                          },
                          50
                        ]
                      },
                      " --chaos ",
                      {
                        "$coalesce": [
                          {
                            "$ref": "request.providerOptions.youchuan-image.chaos"
                          },
                          5
                        ]
                      }
                    ]
                  }
                },
                8192
              ]
            },
            "message": "悠船请求含参考图地址后超过 8192 字符，请减少参考图。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/tob/diffusion",
          "contentType": "application/json",
          "body": {
            "text": {
              "$concat": [
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        0
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            0
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        1
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            1
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        2
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            2
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        3
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            3
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        4
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            4
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        5
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            5
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        6
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            6
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        7
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            7
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        8
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            8
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        9
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            9
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        10
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            10
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        11
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            11
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        12
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            12
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        13
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            13
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        14
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            14
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        15
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            15
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        16
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            16
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        17
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            17
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        18
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            18
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$gt": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        19
                      ]
                    },
                    "then": {
                      "$concat": [
                        {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            19
                          ]
                        },
                        " "
                      ]
                    },
                    "else": ""
                  }
                },
                {
                  "$trim": {
                    "$ref": "request.prompt"
                  }
                },
                {
                  "$if": {
                    "condition": {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "niji-7"
                      ]
                    },
                    "then": " --niji 7",
                    "else": {
                      "$if": {
                        "condition": {
                          "$eq": [
                            {
                              "$ref": "request.model"
                            },
                            "v7"
                          ]
                        },
                        "then": " --v 7",
                        "else": {
                          "$if": {
                            "condition": {
                              "$eq": [
                                {
                                  "$ref": "request.model"
                                },
                                "v8.1"
                              ]
                            },
                            "then": " --v 8.1",
                            "else": " --v 8.2"
                          }
                        }
                      }
                    }
                  }
                },
                " --fast --ar ",
                {
                  "$coalesce": [
                    {
                      "$ref": "request.aspectRatio"
                    },
                    "1:1"
                  ]
                },
                " --stylize ",
                {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.youchuan-image.stylize"
                    },
                    100
                  ]
                },
                " --weird ",
                {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.youchuan-image.weird"
                    },
                    50
                  ]
                },
                " --chaos ",
                {
                  "$coalesce": [
                    {
                      "$ref": "request.providerOptions.youchuan-image.chaos"
                    },
                    5
                  ]
                }
              ]
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/tob/job/{{taskId}}"
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.id"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$if": {
              "condition": {
                "$eq": [
                  {
                    "$ref": "response.status"
                  },
                  1
                ]
              },
              "then": "processing",
              "else": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$ref": "response.status"
                      },
                      2
                    ]
                  },
                  "then": "succeeded",
                  "else": "failed"
                }
              }
            }
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.comment"
              },
              "悠船返回未知状态"
            ]
          },
          "errorPaths": [
            "code"
          ],
          "resultEphemeral": true,
          "images": {
            "$if": {
              "condition": {
                "$and": [
                  {
                    "$eq": [
                      {
                        "$ref": "response.status"
                      },
                      2
                    ]
                  },
                  {
                    "$lte": [
                      {
                        "$len": {
                          "$ref": "response.urls"
                        }
                      },
                      4
                    ]
                  }
                ]
              },
              "then": {
                "$map": {
                  "from": {
                    "$ref": "response.urls"
                  },
                  "as": "image",
                  "in": {
                    "url": {
                      "$if": {
                        "condition": {
                          "$not": {
                            "$at": [
                              {
                                "$ref": "response.audits"
                              },
                              {
                                "$ref": "imageIndex"
                              }
                            ]
                          }
                        },
                        "then": {
                          "$ref": "image"
                        },
                        "else": null
                      }
                    },
                    "id": {
                      "$coalesce": [
                        {
                          "$ref": "response.id"
                        },
                        {
                          "$ref": "taskId"
                        }
                      ]
                    },
                    "order": {
                      "$ref": "imageIndex"
                    }
                  }
                }
              },
              "else": []
            }
          },
          "usage": {
            "audits": {
              "$ref": "response.audits"
            },
            "feeCost": {
              "$ref": "response.cost.feeCost"
            }
          }
        }
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
