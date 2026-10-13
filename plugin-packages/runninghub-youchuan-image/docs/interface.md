# RunningHub 悠船图片 接口字段

## 协议身份

- 插件 ID：`runninghub-youchuan-image`。
- Provider ID：`runninghub-youchuan-image`。
- 能力：`image`。
- 默认 Base URL：`https://www.runninghub.ai`。
- 鉴权驱动：`bearer`。
- 创建：`POST /openapi/v2/youchuan/text-to-image-v81`。
- 查询：`POST /openapi/v2/query`。

## 配置字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | API Key |

## 统一字段映射

| 统一字段 | 类型 | 必填 | 上游映射 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | `create path` | v8.1 / v8.2 / v7 分别选择 text-to-image-v81 / text-to-image-v8.2-fast / text-to-image-v7；不是请求体字段。 |
| `prompt` | string | 是 | `prompt` | 自然语言，不允许手写 -- 参数；长度由后台模型能力配置校验，默认值按模型版本初始化。 |
| `images` | media[] | 否 | `imageUrl` | 最多一张普通 HTTPS 参考图，每张最多 20 MiB；不开放风格或主体参考。 |
| `aspectRatio` | string | 否 | `aspectRatio` | 七种常用比例，默认 1:1。 |
| `imageCount` | integer | 否 | `one job` | 一次提交一个任务，保存实际返回的全部图片；后台配置整次任务价格。 |
| `providerOptions` | object | 否 | `stylize / chaos / weird` | 复用悠船滑块；V8.1 不传 weird。quality 固定字符串 1，V8 系列 hd 固定 false。 |

## 上游请求模板逐字段清单

下表由插件请求模板生成，覆盖 body、query、headers 和 multipart 文件声明中的每个字段。

| 上游位置 | 值或转换表达式 |
| --- | --- |
| `create.method` | `"POST"` |
| `create.path` | `"/openapi/v2/youchuan/text-to-image-v81"` |
| `create.contentType` | `"application/json"` |
| `create.body.prompt` | `{"$trim":{"$ref":"request.prompt"}}` |
| `create.body.aspectRatio` | `{"$coalesce":[{"$ref":"request.aspectRatio"},"1:1"]}` |
| `create.body.imageUrl` | `{"$omitEmpty":{"$first":{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}}}}` |
| `create.body.stylize` | `{"$coalesce":[{"$ref":"request.providerOptions.runninghub-youchuan-image.stylize"},100]}` |
| `create.body.chaos` | `{"$coalesce":[{"$ref":"request.providerOptions.runninghub-youchuan-image.chaos"},5]}` |
| `create.body.weird` | `{"$omitEmpty":{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"v8.1"]},"then":null,"else":{"$coalesce":[{"$ref":"request.providerOptions.runninghub-youchuan-image.weird"},50]}}}}` |
| `create.body.quality` | `"1"` |
| `create.body.hd` | `{"$omitEmpty":{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"v7"]},"then":null,"else":false}}}` |
| `poll.method` | `"POST"` |
| `poll.path` | `"/openapi/v2/query"` |
| `poll.contentType` | `"application/json"` |
| `poll.body.taskId` | `{"$ref":"taskId"}` |

## Provider 扩展键

- `providerOptions.runninghub-youchuan-image.chaos`
- `providerOptions.runninghub-youchuan-image.stylize`
- `providerOptions.runninghub-youchuan-image.weird`

动态模型或工作流允许使用文档声明的完整 `parameters/input/extra_body` 对象；该对象是协议本身的开放 schema，不会被宿主裁剪。

## 响应映射逐字段清单

| 映射位置 | 上游路径或转换表达式 |
| --- | --- |
| `response.taskId` | `{"$coalesce":[{"$ref":"response.taskId"},{"$ref":"taskId"}]}` |
| `response.status` | `{"$if":{"condition":{"$eq":[{"$ref":"response.status"},"SUCCESS"]},"then":"succeeded","else":{"$if":{"condition":{"$eq":[{"$ref":"response.status"},"RUNNING"]},"then":"processing","else":{"$if":{"condition":{"$eq":[{"$ref":"response.status"},"QUEUED"]},"then":"pending","else":"failed"}}}}}}` |
| `response.message` | `{"$coalesce":[{"$ref":"response.errorMessage"},{"$ref":"response.message"},{"$ref":"response.msg"},{"$ref":"response.errorCode"}]}` |
| `response.errorPaths[0]` | `"errorCode"` |
| `response.errorPaths[1]` | `"code"` |
| `response.resultEphemeral` | `true` |
| `response.images` | `{"$if":{"condition":{"$eq":[{"$ref":"response.status"},"SUCCESS"]},"then":{"$map":{"from":{"$filter":{"from":{"$ref":"response.results"},"as":"item","where":{"$in":[{"$lower":{"$ref":"item.outputType"}},["png","jpg","jpeg","webp","gif","avif","bmp"]]}}},"as":"item","in":{"url":{"$ref":"item.url"}}}},"else":null}}` |
| `response.usage` | `{"$ref":"response.usage"}` |

## 响应与错误

插件把上游 task/status/text/media/usage 映射为统一结果。临时媒体 URL 标记为 ephemeral，由宿主立即下载持久化。HTTP 错误、业务 code 和 error object 保持失败语义，不包装成成功。

## 兼容边界

RunningHub 标准模型 API，需企业级-共享 API Key（Bearer），不是 RunningHub Workflow，也不是悠船双凭据协议。仅普通文生图和单张参考图；不开放主体、风格、高清、草图、质量升档、极速或手写参数。模型名 v8.2 对应快速接口。一次按整次任务报价，结果张数以实际返回为准，不按数组长度重复扣费；价格需管理员向 RunningHub 确认，usage 仅保留上游信息，不直接换算本站积分。结果地址有效期 24 小时，立即复用宿主保存恢复链路转存。前台上传提示 10 MB 与 API 参数表 20 MB 有差异，本适配按 API 表限制，真实请求待验证。文档：https://www.runninghub.ai/zh-cn/call-api/api-detail/2052634166820159490 、https://www.runninghub.ai/zh-cn/call-api/api-detail/2133100000000700030 、https://www.runninghub.ai/zh-cn/call-api/api-detail/2016834293520994306 。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "runninghub-youchuan-image",
  "name": "RunningHub 悠船图片",
  "version": "2.0.1",
  "author": "RunningHub / 绘幕",
  "description": "RunningHub 悠船图片 独立请求协议插件。",
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
        "label": "API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "runninghub-youchuan-image",
        "label": "RunningHub 悠船图片",
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
        "baseUrl": "https://www.runninghub.ai",
        "requiresPublicMediaUrls": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "create path",
            "description": "v8.1 / v8.2 / v7 分别选择 text-to-image-v81 / text-to-image-v8.2-fast / text-to-image-v7；不是请求体字段。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "自然语言，不允许手写 -- 参数；长度由后台模型能力配置校验，默认值按模型版本初始化。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "imageUrl",
            "description": "最多一张普通 HTTPS 参考图，每张最多 20 MiB；不开放风格或主体参考。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "aspectRatio",
            "description": "七种常用比例，默认 1:1。"
          },
          {
            "name": "imageCount",
            "type": "integer",
            "required": false,
            "mapping": "one job",
            "description": "一次提交一个任务，保存实际返回的全部图片；后台配置整次任务价格。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "stylize / chaos / weird",
            "description": "复用悠船滑块；V8.1 不传 weird。quality 固定字符串 1，V8 系列 hd 固定 false。"
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
                  "v7"
                ]
              ]
            },
            "message": "RunningHub 悠船仅支持 v8.1、v8.2、v7。"
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
            "message": "RunningHub 悠船一次只能提交一个任务。"
          },
          {
            "assert": {
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
            "message": "RunningHub 悠船提示词不能为空。"
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
            "message": "提示词包含手写模型参数，请移除，并通过模型选择和高级设置调整。"
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
                  "9:16",
                  "16:9",
                  "3:4",
                  "4:3",
                  "3:2",
                  "2:3"
                ]
              ]
            },
            "message": "RunningHub 悠船画面比例不受支持。"
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
                    1
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
            "message": "RunningHub 悠船最多使用一张普通参考图，不支持视频或音频输入。"
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
            "message": "RunningHub 悠船仅支持普通 HTTPS 参考图，不支持蒙版、风格或主体参考；文件大小由后台模型能力配置校验。"
          },
          {
            "assert": {
              "$if": {
                "condition": {
                  "$and": [
                    {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "v8.1"
                      ]
                    },
                    {
                      "$eq": [
                        "stylize",
                        "weird"
                      ]
                    }
                  ]
                },
                "then": true,
                "else": {
                  "$and": [
                    {
                      "$gte": [
                        {
                          "$coalesce": [
                            {
                              "$ref": "request.providerOptions.runninghub-youchuan-image.stylize"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.stylize"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.stylize"
                            },
                            100
                          ]
                        },
                        {
                          "$toInt": {
                            "$coalesce": [
                              {
                                "$ref": "request.providerOptions.runninghub-youchuan-image.stylize"
                              },
                              100
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            "message": "RunningHub 悠船 stylize 必须为 0 到 1000 的整数。"
          },
          {
            "assert": {
              "$if": {
                "condition": {
                  "$and": [
                    {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "v8.1"
                      ]
                    },
                    {
                      "$eq": [
                        "chaos",
                        "weird"
                      ]
                    }
                  ]
                },
                "then": true,
                "else": {
                  "$and": [
                    {
                      "$gte": [
                        {
                          "$coalesce": [
                            {
                              "$ref": "request.providerOptions.runninghub-youchuan-image.chaos"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.chaos"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.chaos"
                            },
                            5
                          ]
                        },
                        {
                          "$toInt": {
                            "$coalesce": [
                              {
                                "$ref": "request.providerOptions.runninghub-youchuan-image.chaos"
                              },
                              5
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            "message": "RunningHub 悠船 chaos 必须为 0 到 100 的整数。"
          },
          {
            "assert": {
              "$if": {
                "condition": {
                  "$and": [
                    {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "v8.1"
                      ]
                    },
                    {
                      "$eq": [
                        "weird",
                        "weird"
                      ]
                    }
                  ]
                },
                "then": true,
                "else": {
                  "$and": [
                    {
                      "$gte": [
                        {
                          "$coalesce": [
                            {
                              "$ref": "request.providerOptions.runninghub-youchuan-image.weird"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.weird"
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
                              "$ref": "request.providerOptions.runninghub-youchuan-image.weird"
                            },
                            50
                          ]
                        },
                        {
                          "$toInt": {
                            "$coalesce": [
                              {
                                "$ref": "request.providerOptions.runninghub-youchuan-image.weird"
                              },
                              50
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            },
            "message": "RunningHub 悠船 weird 必须为 0 到 3000 的整数。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/openapi/v2/youchuan/text-to-image-v81",
          "contentType": "application/json",
          "body": {
            "prompt": {
              "$trim": {
                "$ref": "request.prompt"
              }
            },
            "aspectRatio": {
              "$coalesce": [
                {
                  "$ref": "request.aspectRatio"
                },
                "1:1"
              ]
            },
            "imageUrl": {
              "$omitEmpty": {
                "$first": {
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
                }
              }
            },
            "stylize": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.runninghub-youchuan-image.stylize"
                },
                100
              ]
            },
            "chaos": {
              "$coalesce": [
                {
                  "$ref": "request.providerOptions.runninghub-youchuan-image.chaos"
                },
                5
              ]
            },
            "weird": {
              "$omitEmpty": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$ref": "request.model"
                      },
                      "v8.1"
                    ]
                  },
                  "then": null,
                  "else": {
                    "$coalesce": [
                      {
                        "$ref": "request.providerOptions.runninghub-youchuan-image.weird"
                      },
                      50
                    ]
                  }
                }
              }
            },
            "quality": "1",
            "hd": {
              "$omitEmpty": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$ref": "request.model"
                      },
                      "v7"
                    ]
                  },
                  "then": null,
                  "else": false
                }
              }
            }
          },
          "originPath": true,
          "pathTemplate": {
            "$if": {
              "condition": {
                "$eq": [
                  {
                    "$ref": "request.model"
                  },
                  "v8.1"
                ]
              },
              "then": "/openapi/v2/youchuan/text-to-image-v81",
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
                  "then": "/openapi/v2/youchuan/text-to-image-v7",
                  "else": "/openapi/v2/youchuan/text-to-image-v8.2-fast"
                }
              }
            }
          }
        },
        "poll": {
          "method": "POST",
          "path": "/openapi/v2/query",
          "contentType": "application/json",
          "body": {
            "taskId": {
              "$ref": "taskId"
            }
          },
          "originPath": true
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.taskId"
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
                  "SUCCESS"
                ]
              },
              "then": "succeeded",
              "else": {
                "$if": {
                  "condition": {
                    "$eq": [
                      {
                        "$ref": "response.status"
                      },
                      "RUNNING"
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
                          "QUEUED"
                        ]
                      },
                      "then": "pending",
                      "else": "failed"
                    }
                  }
                }
              }
            }
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.errorMessage"
              },
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.msg"
              },
              {
                "$ref": "response.errorCode"
              }
            ]
          },
          "errorPaths": [
            "errorCode",
            "code"
          ],
          "resultEphemeral": true,
          "images": {
            "$if": {
              "condition": {
                "$eq": [
                  {
                    "$ref": "response.status"
                  },
                  "SUCCESS"
                ]
              },
              "then": {
                "$map": {
                  "from": {
                    "$filter": {
                      "from": {
                        "$ref": "response.results"
                      },
                      "as": "item",
                      "where": {
                        "$in": [
                          {
                            "$lower": {
                              "$ref": "item.outputType"
                            }
                          },
                          [
                            "png",
                            "jpg",
                            "jpeg",
                            "webp",
                            "gif",
                            "avif",
                            "bmp"
                          ]
                        ]
                      }
                    }
                  },
                  "as": "item",
                  "in": {
                    "url": {
                      "$ref": "item.url"
                    }
                  }
                }
              },
              "else": null
            }
          },
          "usage": {
            "$ref": "response.usage"
          }
        }
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
