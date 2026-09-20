import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 本项目根目录混入过 Python venv（akshare 等），里面的 JS 不是我们的代码
    ".venv/**",
    "venv/**",
  ]),
  {
    rules: {
      // ---------------------------------------------------------------------
      // 两条"风格/类型"规则降级为 warning（不是 bug，需要专门一轮重构）
      //
      // 1) no-explicit-any：剩余约 40 处集中在「localStorage / 云端 API 返回值的
      //    宽松数据」上（如 JSON.parse(localStorage.getItem('minitu_notes'))、
      //    metadata 字段、map/filter 回调参数）。逐处补类型要按文件定义领域类型
      //    （Note / Collection / Resource.metadata 的形状），一次性改会有连锁类型
      //    错误和回归风险，所以先降级防止新增，同时保留可见的 warning 清单。
      //    已修的：所有 catch (e: any) 冗余标注、图标映射表 Record<..., LucideIcon>、
      //    playsInline / result.status 等断言。
      // 2) react-hooks/set-state-in-effect：React 19 新规则，对"effect 里同步
      //    setState"零容忍。本项目大量模式是「挂载后从 localStorage/云端拉数据再
      //    setState」「props → state 同步」，都是有意为之；改成 useSyncExternalStore /
      //    派生值是大改造，收益低于风险，因此降级为 warning。
      // ---------------------------------------------------------------------
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
