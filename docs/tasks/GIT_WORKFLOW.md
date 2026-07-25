# Git 工作流 · GIT WORKFLOW

## 分支

| 分支 | 用途 |
|---|---|
| `main` | 稳定基线 |
| `integration` | 集成验证 |
| `feat/c1-foundation` | C1 |
| `feat/c2-dashboard-brief` | C2 |
| `feat/c3-brand-brain` | C3 |
| `feat/c4-script-editor` | C4 |
| `feat/c5-storyboard` | C5 |
| `feat/c6-rough-cut` | C6 |
| `feat/c7-integration-tests` | C7 |

## 推荐 Worktree

```
worktrees/c1-foundation
worktrees/c2-dashboard-brief
worktrees/c3-brand-brain
worktrees/c4-script-editor
worktrees/c5-storyboard
worktrees/c6-rough-cut
worktrees/c7-tests
```

## 建议命令（Gate0 后由人执行）

```bash
git init
git add .
git commit -m "chore: gate0 bootstrap governance and app skeleton"
git branch integration
git branch feat/c1-foundation
```

Worktree 示例：

```bash
git worktree add ../worktrees/c1-foundation feat/c1-foundation
```

## 提交规范

- `feat(c2): ...`
- `fix(c5): ...`
- `docs(c0): ...`
- `test(c7): ...`
- `chore: ...`

## 合并规则

1. 线程自检 lint/build/test
2. 更新 HANDOFF + Commit Hash
3. C0 Gate Review
4. 合入 `integration`
5. Gate 通过后合入 `main`

## 当前阶段说明

Gate 0 将初始化 git 仓库并提交基线（若环境允许）。  
不批量创建 worktree，除非仓库干净且 C0 明确需要。
