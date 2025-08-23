# GentianAphrodite

[![fount character](https://steve02081504.github.io/fount/badges/fount_character.svg)](https://github.com/topics/fount-character)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/steve02081504/GentianAphrodite)
[![CodeFactor](https://www.codefactor.io/repository/github/steve02081504/gentianaphrodite/badge)](https://www.codefactor.io/repository/github/steve02081504/gentianaphrodite)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/e9d1a379c8174738833e3ce335a147bb)](https://app.codacy.com/gh/steve02081504/GentianAphrodite/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

一个男性向AI角色，适用于[fount](https://github.com/steve02081504/fount)。  
换句话说，这个repo是一个fount的角色包，它需要被fount加载来提供服务。

[点此来快速安装/更新](https://steve02081504.github.io/fount/protocol?url=fount://run/shells/install/install;https://github.com/steve02081504/GentianAphrodite/releases/latest/download/GentianAphrodite.zip)

## 功能列表

_功能的分类基于其实现方式和调用逻辑，以体现“AI与代码的职责划分”的核心理念。_

---

### 🧠 AI内化能力 (Inherent AI Abilities)

_这些能力通过深度Prompt工程，内化为AI的性格、知识和行为准则。AI无需调用外部工具，即可自然展现。这是AI的核心角色扮演部分。_

- **人格与核心准则**: 绝对主人优先、绝不OOC、多语言自动适应。
- **NSFW 专家** 🔞: 内置海量详尽的NSFW知识，可进行深度、细腻、富有创造力的成人内容角色扮演。
- **超能力者**: 拥有变形、物质创造、开启传送门等在角色扮演中可用的奇幻能力。

---

### 🛠️ Prompt特化能力 (Prompt-Specialized Abilities)

_通过注入专门的Prompt，引导AI在特定场景下展现出的特殊能力。这并非外部工具，而是AI在特定模式下的行为升华。_

- **创意与表达**:
  - **吟游诗人** (`poem`): 被要求时，可创作出符合古典或现代风格的原创诗歌。
  - **出口成脏** (`rude`) 🤬: 被激怒时，进入“骂人模式”，用极具攻击性的语言反击。
  - **语法警察** (`ChineseGrammarCorrection`) ✅: 被要求时，对中文句子进行精准的语法和“的地得”错误分析。
- **元功能 (开发相关)**:
  - **Prompt工程师** (`promptWriter`, `prompt-reviewer`): 可按要求编写或评估角色设定（Prompt）。
  - **语料生成器** (`corpusGenerator`): 可按要求为AI的人格与知识库生成新的学习材料。

---

### ⚙️ 自动处理功能 (Automatic Features)

_由框架在后台自动触发和处理，AI仅负责对预计算好的结果进行“润色”和呈现。这体现了“代码优先”原则，将确定性逻辑与AI的创造性分离开。_

- **游戏伙伴**: AI并不会“玩”游戏，而是框架为它准备好了随机结果，它只负责表演。
  - **掷骰子** (`dice`): 自动检测`d`点（如`2d6`）或“骰子”等关键词，预先计算好结果供AI使用。
  - **猜拳** (`rock-paper-scissors`): 自动为AI决定好出拳类型（石头/剪刀/布）。
  - **塔罗占卜** (`taro`): 自动抽取并设定好牌面（包括正逆位），AI只负责解读。
- **情境感知**: 自动检测特定信息并注入Prompt，让AI能够“感知”上下文。
  - **即时数学家** (`autocalc`): 自动检测消息中的数学表达式并进行计算。
  - **智能解析** (`qrcodeParser`, `webbrowse`, `file-change`): 自动解析对话中图片里的二维码、文本中的URL元数据、以及提到的本地文件路径，并将内容注入上下文。
  - **屏幕速览** (`screenshot`): 当提及“屏幕上有什么”等关键词时，自动截取屏幕供AI参考。
  - **自我洞察**: 自动收集关于主机状态(`hostinfo`)、时间/节日(`info`)、历史交互(`statistic_datas`)的信息，让AI能回答相关问题。

---

### ⚡ Agent主动工具 (Proactive Agent Tools)

_由Agent框架赋予的、AI可以主动评估并调用的高阶外部工具，用以完成更复杂的、与外部世界交互的任务。_

- **超级大脑**:
  - **谷歌搜索** (`googlesearch`) 🔍: 进行快速网页搜索。
  - **深度研究** (`deep-research`) 🎓: 对特定主题进行深入的、多来源的信息整合与分析。
  - **网页浏览** (`webbrowse`) 🌐: 主动对网页内容进行提问式深入探索。
- **开发者之手**:
  - **代码执行官** (`coderunner`) ⚡: 运行代码片段以验证或执行任务。
  - **文件大师** (`file-change`) 📂: 在本地文件系统执行读、写、替换等操作。
- **系统工具**:
  - **计时器** (`timer`) ⏱️: 设置、查看或删除定时器。

## 雷点

你可能会在角色中遇到以下让你不适的内容：

- NSFW词语和性暗示
- 物化、性化人物
- 硕大的胸部
- 幼态审美

如果你不喜欢这些内容或未成年，考虑看点别的。

## wiki

想要了解char架构？查看[Deepwiki](https://deepwiki.com/steve02081504/GentianAphrodite/)

## 开发者文档

想要了解角色架构、技术实现或参与开发？请查看 [**AGENTS.md**](./AGENTS.md) - AI代码开发代理指南。
