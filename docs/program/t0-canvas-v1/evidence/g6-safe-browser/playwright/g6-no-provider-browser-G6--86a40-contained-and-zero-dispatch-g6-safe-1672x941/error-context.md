# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: g6-no-provider-browser.spec.ts >> G6 no-provider real route is visibly blocked, reload-stable, contained and zero-dispatch
- Location: tests/e2e/canvas-v1/g6-no-provider-browser.spec.ts:82:1

# Error details

```
Error: [{"path":"/api/production/pilot/canvas/bootstrap","status":200,"code":null},{"path":"/api/production/pilot/canvas/bootstrap","status":409,"code":"PILOT_CANVAS_CONFLICT"},{"path":"/api/production/pilot/canvas/v1/bootstrap","status":401,"code":"CANVAS_SESSION_INVALID"}]

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - complementary [ref=f1e5]:
    - generic [ref=f1e6]:
      - generic [ref=f1e7]:
        - generic [ref=f1e8]: VA
        - generic [ref=f1e9]:
          - generic [ref=f1e10]: 短视频 Agent
          - generic [ref=f1e11]: 统一创作工作台
      - menu [ref=f1e12]:
        - menuitem "folder-open 项目" [ref=f1e13] [cursor=pointer]:
          - img "folder-open" [ref=f1e14]
          - generic [ref=f1e17]: 项目
        - menuitem "cluster 品牌大脑" [ref=f1e18] [cursor=pointer]:
          - img "cluster" [ref=f1e19]
          - generic [ref=f1e22]: 品牌大脑
        - menuitem "file-text 脚本编辑" [ref=f1e23] [cursor=pointer]:
          - img "file-text" [ref=f1e24]
          - generic [ref=f1e27]: 脚本编辑
        - menuitem "video-camera 分镜生产单" [ref=f1e28] [cursor=pointer]:
          - img "video-camera" [ref=f1e29]
          - generic [ref=f1e32]: 分镜生产单
        - menuitem "fund-view 任务 / 交付" [ref=f1e33] [cursor=pointer]:
          - img "fund-view" [ref=f1e34]
          - generic [ref=f1e39]: 任务 / 交付
        - menuitem "appstore 生产概览" [ref=f1e40] [cursor=pointer]:
          - img "appstore" [ref=f1e41]
          - generic [ref=f1e44]: 生产概览
        - menuitem "inbox 生产包" [ref=f1e45] [cursor=pointer]:
          - img "inbox" [ref=f1e46]
          - generic [ref=f1e49]: 生产包
        - menuitem "api StoryCanvas" [ref=f1e50] [cursor=pointer]:
          - img "api" [ref=f1e51]
          - generic [ref=f1e54]: StoryCanvas
        - menuitem "video-camera 生成任务" [ref=f1e55] [cursor=pointer]:
          - img "video-camera" [ref=f1e56]
          - generic [ref=f1e59]: 生成任务
        - menuitem "file-done 媒体资产" [ref=f1e60] [cursor=pointer]:
          - img "file-done" [ref=f1e61]
          - generic [ref=f1e64]: 媒体资产
        - menuitem "wallet 导出 / 来源链" [ref=f1e65] [cursor=pointer]:
          - img "wallet" [ref=f1e66]
          - generic [ref=f1e69]: 导出 / 来源链
      - generic [ref=f1e70]:
        - generic [ref=f1e71]: PILOT · ready
        - generic [ref=f1e72]: Pilot E2E Tenant A
        - generic [ref=f1e73]: Pilot E2E Assigned Project · 66000000-0000-4000-8000-000000000001
  - generic [ref=f1e74]:
    - banner [ref=f1e75]:
      - generic [ref=f1e76]:
        - navigation [ref=f1e77]:
          - list [ref=f1e78]:
            - listitem [ref=f1e79]:
              - generic [ref=f1e80]: 统一创作工作台
            - listitem [ref=f1e82]: /
            - listitem [ref=f1e83]: StoryCanvas 入口
        - strong [ref=f1e85]: StoryCanvas 入口
      - generic [ref=f1e86]:
        - generic "当前 Pilot 项目" [ref=f1e88] [cursor=pointer]:
          - generic [ref=f1e90]:
            - combobox "当前 Pilot 项目" [ref=f1e92]
            - generic "Pilot E2E Assigned Project" [ref=f1e93]
        - generic [ref=f1e95]:
          - img "user" [ref=f1e96]
          - generic [ref=f1e99]: Pilot E2E Tenant A Operator · content_operator
        - generic [ref=f1e100]: Pilot E2E Tenant A
        - button "logout 安全退出" [ref=f1e103] [cursor=pointer]:
          - img "logout" [ref=f1e105]
          - generic [ref=f1e108]: 安全退出
    - main [ref=f1e109]:
      - alert [ref=f1e111]:
        - strong [ref=f1e112]: StoryCanvas Pilot 服务暂不可用
        - generic [ref=f1e113]: Project 66000000-0000-4000-8000-000000000001 · 入口未能建立完整生产权限边界。
        - generic [ref=f1e114]: 系统不会回退 Demo，也不会使用默认项目或默认内容。
```

# Test source

```ts
  83  |   page,
  84  | }, testInfo) => {
  85  |   expect(projectId).toMatch(UUID);
  86  |   expect(packageId).toMatch(UUID);
  87  |   expect(baseUrl.origin).toBe('http://127.0.0.1:5177');
  88  | 
  89  |   const consoleOutput: string[] = [];
  90  |   const pageErrors: string[] = [];
  91  |   const apiUrls: string[] = [];
  92  |   const activationRequests: Record<string, unknown>[] = [];
  93  |   const approvalRequests: Record<string, unknown>[] = [];
  94  |   const commandRequests: Record<string, unknown>[] = [];
  95  |   const workspaceResponses: Record<string, unknown>[] = [];
  96  |   const bootstrapResponses: Record<string, unknown>[] = [];
  97  |   const browserApiResponses: unknown[] = [];
  98  |   const safeResponseFacts: Array<{ path: string; status: number; code: string | null }> = [];
  99  |   const responseReads: Promise<void>[] = [];
  100 |   const requestHeaderReads: Promise<void>[] = [];
  101 |   const nonLoopbackRequests: string[] = [];
  102 | 
  103 |   page.on('console', (message) => consoleOutput.push(`${message.type()}:${message.text()}`));
  104 |   page.on('pageerror', (error) => pageErrors.push(error.message));
  105 |   page.on('request', (request) => {
  106 |     const url = new URL(request.url());
  107 |     if (!['127.0.0.1', 'data:', 'blob:'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) {
  108 |       nonLoopbackRequests.push(request.url());
  109 |     }
  110 |     if (!url.pathname.startsWith('/api/')) return;
  111 |     apiUrls.push(request.url());
  112 |     expect(url.origin).toBe(baseUrl.origin);
  113 |     requestHeaderReads.push((async () => {
  114 |       const completeHeaders = await request.allHeaders();
  115 |       expect(completeHeaders.authorization).toBeUndefined();
  116 |       expect(completeHeaders['idempotency-key']).toBeUndefined();
  117 |       if (url.pathname.endsWith('/canvas-activation')) {
  118 |         expect(completeHeaders.origin).toBe(baseUrl.origin);
  119 |         expect(completeHeaders['x-csrf-token']).toBeTruthy();
  120 |       }
  121 |       if (url.pathname === '/api/production/pilot/canvas/bootstrap') {
  122 |         expect(completeHeaders.origin).toBe(baseUrl.origin);
  123 |         expect(completeHeaders['x-storycanvas-csrf']).toBe('pilot-canvas-bootstrap-v1');
  124 |       }
  125 |       if (url.pathname.startsWith('/api/production/pilot/canvas/v1/')) {
  126 |         expect(completeHeaders['x-canvas-session-id']).toMatch(/^pcs_[A-Za-z0-9_-]{24,128}$/u);
  127 |       }
  128 |     })());
  129 |     if (url.pathname.endsWith('/canvas-activation')) {
  130 |       activationRequests.push(jsonBody(request));
  131 |     }
  132 |     if (url.pathname.endsWith('/canvas-command-approvals')) {
  133 |       approvalRequests.push(jsonBody(request));
  134 |     }
  135 |     if (url.pathname === '/api/production/pilot/canvas/v1/commands') {
  136 |       commandRequests.push(jsonBody(request));
  137 |     }
  138 |   });
  139 |   page.on('response', (response) => {
  140 |     const pathname = new URL(response.url()).pathname;
  141 |     const contentType = response.headers()['content-type']?.toLowerCase() ?? '';
  142 |     if (!pathname.startsWith('/api/') || !contentType.includes('application/json')) return;
  143 |     responseReads.push(
  144 |       (async () => {
  145 |         const value = await boundedJson(response);
  146 |         if (!value) return;
  147 |         browserApiResponses.push(value);
  148 |         const error = value.error as Record<string, unknown> | undefined;
  149 |         safeResponseFacts.push({
  150 |           path: pathname,
  151 |           status: response.status(),
  152 |           code: typeof error?.code === 'string' ? error.code : null,
  153 |         });
  154 |         if (pathname === '/api/production/pilot/canvas/v1/bootstrap') {
  155 |           bootstrapResponses.push(value);
  156 |         }
  157 |         if (pathname === '/api/production/pilot/canvas/v1/workspace') {
  158 |           workspaceResponses.push(value);
  159 |         }
  160 |       })(),
  161 |     );
  162 |   });
  163 | 
  164 |   await page.goto('/login');
  165 |   await page.getByTestId('pilot-login-email').fill(loginEmail);
  166 |   await page.getByTestId('pilot-login-password').fill(loginPassword);
  167 |   await page.getByTestId('pilot-login-submit').click();
  168 |   await expect(page.getByTestId('pilot-app-shell')).toBeVisible();
  169 | 
  170 |   const canonicalPath = `/production/canvas/${projectId}?packageId=${packageId}`;
  171 |   await page.goto(canonicalPath);
  172 |   await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
  173 |   await expect.poll(
  174 |     () => safeResponseFacts.some(({ path }) => path === '/api/production/pilot/canvas/v1/bootstrap'),
  175 |   ).toBe(true);
  176 |   const transportFacts = safeResponseFacts.filter(({ path }) =>
  177 |     path === '/api/production/pilot/canvas/bootstrap'
  178 |     || path === '/api/production/pilot/canvas/v1/bootstrap');
  179 |   expect(
  180 |     transportFacts.filter(({ path }) => path === '/api/production/pilot/canvas/bootstrap')
  181 |       .every(({ status }) => status === 200),
  182 |     JSON.stringify(transportFacts),
> 183 |   ).toBe(true);
      |     ^ Error: [{"path":"/api/production/pilot/canvas/bootstrap","status":200,"code":null},{"path":"/api/production/pilot/canvas/bootstrap","status":409,"code":"PILOT_CANVAS_CONFLICT"},{"path":"/api/production/pilot/canvas/v1/bootstrap","status":401,"code":"CANVAS_SESSION_INVALID"}]
  184 |   expect(
  185 |     transportFacts.filter(({ path }) => path === '/api/production/pilot/canvas/v1/bootstrap')
  186 |       .every(({ status }) => status === 200),
  187 |     JSON.stringify(transportFacts),
  188 |   ).toBe(true);
  189 |   await expect(page.getByRole('status')).toBeHidden();
  190 |   await Promise.all(responseReads);
  191 |   expect(
  192 |     await page.getByTestId('pilot-storycanvas-boundary-blocked').isVisible().catch(() => false),
  193 |     JSON.stringify(safeResponseFacts),
  194 |   ).toBe(false);
  195 |   await expect(page.getByRole('textbox', { name: '生成提示' })).toBeVisible();
  196 |   await expect(page.getByText('Seedance 能力当前不可用').first()).toBeVisible();
  197 |   await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
  198 |   await Promise.all(requestHeaderReads);
  199 |   expect(workspaceResponses.length).toBeGreaterThanOrEqual(1);
  200 |   expect(bootstrapResponses.length).toBeGreaterThanOrEqual(1);
  201 |   const initialWorkspace = stableWorkspace(workspaceResponses.at(-1)!);
  202 |   const initialBootstrap = bootstrapResponses.at(-1)!.bootstrap as Record<string, unknown>;
  203 |   expect(initialBootstrap.status).toBe('blocked');
  204 |   for (const shot of (workspaceResponses.at(-1)!.shots as Array<Record<string, unknown>>)) {
  205 |     const readiness = shot.readiness as Record<string, unknown>;
  206 |     expect(readiness.ready).toBe(false);
  207 |     expect(readiness.reasonCodes).toEqual(expect.arrayContaining([
  208 |       'PROVIDER_UNAVAILABLE',
  209 |       'ENTITY_BINDING_MISSING',
  210 |       'CAPABILITY_UNAVAILABLE',
  211 |     ]));
  212 |   }
  213 | 
  214 |   await page.reload();
  215 |   await expect(page.getByText(projectName, { exact: true })).toBeVisible();
  216 |   await expect(page.getByRole('button', { name: '生成当前镜头' })).toBeDisabled();
  217 |   await expect(page.getByText('Seedance 能力当前不可用').first()).toBeVisible();
  218 |   await Promise.all(responseReads);
  219 |   await Promise.all(requestHeaderReads);
  220 |   expect(workspaceResponses.length).toBeGreaterThanOrEqual(2);
  221 |   expect(stableWorkspace(workspaceResponses.at(-1)!)).toEqual(initialWorkspace);
  222 | 
  223 |   expect(approvalRequests).toHaveLength(0);
  224 |   expect(commandRequests).toHaveLength(0);
  225 |   expect(nonLoopbackRequests).toHaveLength(0);
  226 |   const attemptIds = activationRequests.map((request) => request.activationAttemptId as string);
  227 |   expect(attemptIds.length).toBeGreaterThanOrEqual(2);
  228 |   expect(new Set(attemptIds).size).toBe(attemptIds.length);
  229 | 
  230 |   const surface = await browserSurface(page);
  231 |   expect(surface.url).toBe(`${baseUrl.origin}${canonicalPath}`);
  232 |   expect(surface.localStorage).toEqual([]);
  233 |   expect(surface.sessionStorage).toEqual([]);
  234 |   expect(surface.indexedDbNames).toEqual([]);
  235 |   expect(pageErrors).toEqual([]);
  236 |   const auditedBrowserEvidence =
  237 |     `${surface.url}\n${surface.text}\n${surface.html}\n${JSON.stringify(consoleOutput)}\n` +
  238 |     `${JSON.stringify(browserApiResponses)}\n${JSON.stringify(approvalRequests)}\n` +
  239 |     JSON.stringify(commandRequests);
  240 |   for (const attempt of attemptIds) expect(auditedBrowserEvidence).not.toContain(attempt);
  241 |   for (const marker of forbiddenMarkers) {
  242 |     expect(auditedBrowserEvidence.toLowerCase()).not.toContain(marker.toLowerCase());
  243 |   }
  244 | 
  245 |   const observedPaths = apiUrls.map((url) => new URL(url).pathname);
  246 |   for (const requiredPath of [
  247 |     `/api/v1/projects/${projectId}/production-packages/${packageId}/canvas-activation`,
  248 |     '/api/production/pilot/canvas/bootstrap',
  249 |     '/api/production/pilot/canvas/v1/bootstrap',
  250 |     '/api/production/pilot/canvas/v1/workspace',
  251 |   ]) expect(observedPaths).toContain(requiredPath);
  252 |   expect(observedPaths).not.toContain(`/api/v1/projects/${projectId}/canvas-command-approvals`);
  253 |   expect(observedPaths).not.toContain('/api/production/pilot/canvas/v1/commands');
  254 |   const sessionCookie = (await page.context().cookies()).find(
  255 |     ({ name }) => name === 'videoagent_session',
  256 |   );
  257 |   expect(sessionCookie?.httpOnly).toBe(true);
  258 | 
  259 |   await page.screenshot({
  260 |     path: testInfo.outputPath(`g6-no-provider-${testInfo.project.name}.png`),
  261 |     fullPage: true,
  262 |   });
  263 | });
  264 | 
```