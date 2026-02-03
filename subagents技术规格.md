功能：
subagents使用可被主agent配置的prompt和功能以及模型，以某个目标执行任务，旨在并发、高效、节约地完成复杂任务。

基本思路：
每个subagent有着独立于主agent的长/短期记忆。
subagent可以被配置以下内容：

- 任务目标
- 使用的AI源（可以访问用户的全部ai源列表）
- 是否可访问父agent的长短期记忆（暨，若此项开启则此agent的记忆将包含其父agent的记忆内容，但其无法修改或写入父agent的记忆）
- 可同时存在的子agent数量，若为0则此agent无法生成子agent
  其子agent的子agent在新建agent时同样会令此数值减少
- （只在此agent有人设时可启用）是否将人设信息激活（暨在prompt构建阶段合并role_settings部分的prompt）
- 任务结束后是否将长期记忆合并回父agent
- 是否作为长期子agent（任务完成后不被销毁，只是吊起并可以重新复用）
- 激活的功能

记忆合并：
在记忆合并时，若有长期记忆，由父agent审视抽样内容并主动决定要不要接受合并
