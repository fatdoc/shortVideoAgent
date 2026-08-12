import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFilter,
  IconLink,
  IconMapPin,
  IconPlayerPlayFilled,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTarget,
  IconUpload,
  IconUser,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEMO_PROJECT_ID } from '../../domain/constants';

const photos = {
  storefront: '/media/shot-01-storefront.png',
  interior: '/media/shot-02-interior.png',
  barista: '/media/reference-barista.png',
  pour: '/media/shot-03-pourover.png',
  latte: '/media/shot-04-tasting.png',
  cold: '/media/reference-cafe.png',
  pastry: '/media/shot-05-window.png',
  table: '/media/shot-02-interior.png',
  guest: '/media/shot-04-tasting.png',
} as const;

const shortDate = '2026-08-11';

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="store-page-header">
      <div>
        {eyebrow ? <span className="store-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'accent' }) {
  return <span className={`store-status is-${tone}`}>{children}</span>;
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button type="button" className="store-button store-button--secondary" onClick={onClick}>{children}</button>;
}

function PrimaryButton({ children, onClick, testId }: { children: ReactNode; onClick?: () => void; testId?: string }) {
  return <button type="button" className="store-button store-button--primary" onClick={onClick} data-testid={testId}>{children}</button>;
}

function EmptyData({ label }: { label: string }) {
  return (
    <div className="store-empty-data">
      <span><IconAlertCircle size={18} /></span>
      <div><strong>暂无真实{label}</strong><p>后端归因或 Provider 接通后在此展示，当前不生成模拟成功数据。</p></div>
    </div>
  );
}

export function StoreWorkbenchPage() {
  const navigate = useNavigate();
  const projectId = useParams().projectId ?? DEMO_PROJECT_ID;
  const queue = [
    ['手冲咖啡工艺体验', '分镜待确认', '探店视频', '今天 10:24'],
    ['国贸店环境氛围', '脚本待确认', '探店视频', '今天 09:51'],
    ['新品豆单介绍', '脚本待确认', '商品视频', '昨天 18:32'],
    ['轻食搭配推荐', '粗剪检查中', '探店视频', '昨天 17:16'],
  ];
  return (
    <section className="store-page" data-testid="store-workbench-page">
      <PageHeader
        eyebrow="门店总览"
        title="今天从待确认内容开始"
        description="检查门店资料、推进探店视频生产，并为投流获客补齐必要配置。"
        action={<PrimaryButton onClick={() => navigate('/projects/new')}>新建获客任务</PrimaryButton>}
      />
      <div className="workbench-hero">
        <img src={photos.storefront} alt="虚构咖啡店门头示意" />
        <div className="workbench-store-summary">
          <span>当前门店</span><h2>拾光咖啡 · 国贸店</h2>
          <p>国贸商圈精品咖啡店，内容方向聚焦通勤、手冲体验与午后轻食。</p>
          <div className="summary-metrics">
            <div><strong>92%</strong><span>门店资料</span></div>
            <div><strong>38</strong><span>可用资产</span></div>
            <div><strong>3</strong><span>待确认脚本</span></div>
          </div>
        </div>
        <div className="workbench-task-summary">
          <div className="section-title"><h3>进行中的获客任务</h3><button type="button">查看全部 <IconArrowRight size={15} /></button></div>
          <div className="campaign-mini"><img src={photos.guest} alt="探店内容缩略图" /><div><strong>夏日冷萃体验官招募</strong><span>待配置投放 · 剩余 6 天</span></div><Status tone="warn">待配置</Status></div>
          <div className="campaign-mini"><img src={photos.cold} alt="咖啡内容缩略图" /><div><strong>周末早餐搭配推荐</strong><span>脚本生产中 · 剩余 3 天</span></div><Status tone="accent">生产中</Status></div>
        </div>
      </div>
      <div className="store-split store-split--wide">
        <section className="store-surface">
          <div className="section-title"><div><h2>生产队列</h2><p>需要人工确认的探店脚本与分镜。</p></div><span>共 {queue.length} 项</span></div>
          <div className="store-table store-table--queue">
            <div className="store-table-head"><span>内容</span><span>类型</span><span>状态</span><span>更新时间</span><span>下一步</span></div>
            {queue.map((row, index) => (
              <div className="store-table-row" key={row[0]}>
                <span className="media-cell"><img src={[photos.pour, photos.interior, photos.latte, photos.pastry][index]} alt="" /><strong>{row[0]}</strong></span>
                <span>{row[2]}</span><Status tone={index < 2 ? 'warn' : 'neutral'}>{row[1]}</Status><span>{row[3]}</span>
                <button type="button" onClick={() => navigate(index === 0 ? `/projects/${projectId}/storyboard` : `/projects/${projectId}/script`)}>去确认</button>
              </div>
            ))}
          </div>
        </section>
        <aside className="store-inspector">
          <section><div className="section-title"><h3>下一步</h3></div><ol className="next-step-list"><li className="is-done"><IconCheck size={15} />门店资料已核验</li><li><span>2</span>确认 3 个探店脚本</li><li><span>3</span>补齐 2 个缺失镜头</li><li><span>4</span>配置发布平台与归因</li></ol></section>
          <section><div className="section-title"><h3>线索状态</h3></div><EmptyData label="线索归因数据" /></section>
        </aside>
      </div>
    </section>
  );
}

const facts = [
  ['门店地址', '北京市朝阳区建国门外大街 1 号，国贸商城北区一层'],
  ['营业时间', '周一至周日 07:30–22:00'],
  ['联系电话', '010-6505 7890'],
  ['服务半径', '步行 800 米 / 驾车 3 公里'],
  ['座位数量', '室内 46 席，室外 12 席'],
  ['人均消费', '48–68 元'],
  ['支持服务', '堂食 / 外带 / 预约 / 到店券'],
  ['支持平台', '抖音 / 视频号 / 小红书 / 快手'],
];

export function StoreProfilePage() {
  return (
    <section className="store-page" data-testid="store-profile-page">
      <PageHeader eyebrow="门店建档" title="门店档案" description="所有脚本、分镜与投放配置引用同一份门店事实；变更需重新核验。" action={<PrimaryButton>编辑档案</PrimaryButton>} />
      <div className="profile-layout">
        <aside className="profile-summary">
          <img src={photos.storefront} alt="拾光咖啡门店外观示意" />
          <div className="profile-name"><h2>拾光咖啡 · 国贸店</h2><Status tone="good"><IconCircleCheck size={13} /> 已核验</Status></div>
          <dl><div><dt>门店编号</dt><dd>SGKF-GM002</dd></div><div><dt>门店类型</dt><dd>直营门店</dd></div><div><dt>开业时间</dt><dd>2023-06-18</dd></div><div><dt>经营主体</dt><dd>拾光咖啡（北京）有限公司</dd></div><div><dt>门店面积</dt><dd>186 m²</dd></div></dl>
          <div className="tag-line"><span>商务洽谈</span><span>静谧空间</span><span>精品咖啡</span><span>全日轻食</span></div>
        </aside>
        <main className="profile-facts store-surface">
          <div className="store-tabs"><button className="is-active">经营信息</button><button>门店定位</button><button>服务能力</button><button>事实语料</button><button>禁用表达</button></div>
          <h3>基础信息</h3>
          <dl className="fact-list">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><Status tone="good">已核验</Status></div>)}</dl>
          <h3>经营资质</h3>
          <dl className="fact-list"><div><dt>食品经营许可证</dt><dd>JY11101050081234 · 有效至 2028-06-19</dd><Status tone="good">已核验</Status></div><div><dt>营业执照</dt><dd>京商登记字第 1101052023006423 号 · 长期</dd><Status tone="good">已核验</Status></div></dl>
        </main>
        <aside className="store-inspector">
          <section><div className="section-title"><h3>资料来源</h3><button type="button">查看来源</button></div><dl className="inspector-list"><div><dt>信息来源</dt><dd>门店实地核验 + 商户提交资料</dd></div><div><dt>最近核验</dt><dd>{shortDate}</dd></div><div><dt>验证人</dt><dd>平台审核团队</dd></div><div><dt>验证状态</dt><dd><Status tone="good">已核验</Status></dd></div></dl></section>
          <section><div className="section-title"><h3>完整度</h3><strong className="accent-number">96%</strong></div><div className="progress-line"><i style={{ width: '96%' }} /></div><ul className="check-list"><li><IconCheck />基础信息</li><li><IconCheck />经营资质</li><li><IconCheck />服务能力</li><li><IconCheck />事实语料</li></ul></section>
          <section><div className="section-title"><h3>变更记录</h3></div><p className="muted-copy">最近一次更新：营业时间 · {shortDate}</p></section>
        </aside>
      </div>
    </section>
  );
}

const offers = [
  [photos.pour, '手冲体验', '到店套餐', '68', '精品单品手冲、产地风味', '咖啡体验 / 个人放松'],
  [photos.pastry, '双人下午茶', '到店套餐', '128', '甜点搭配、两杯饮品', '朋友聚会 / 休闲下午'],
  [photos.latte, '招牌拿铁', '单品', '32', '奶咖平衡、口感顺滑', '日常饮用 / 提神醒脑'],
  [photos.cold, '美式咖啡', '单品', '28', '清爽顺口、纯粹咖啡风味', '工作学习 / 日常饮用'],
  [photos.pastry, '巴斯克芝士蛋糕', '单品', '36', '绵密香浓、焦香表面', '甜点搭配 / 下午茶'],
];

export function OfferCatalogPage() {
  return (
    <section className="store-page" data-testid="store-offer-page">
      <PageHeader eyebrow="商品套餐" title="商品与优惠管理" description="为探店脚本提供可引用、可核验的商品权益；未接通库存时仅展示资料状态。" action={<PrimaryButton><IconPlus size={17} /> 新增商品</PrimaryButton>} />
      <div className="catalog-layout">
        <section className="store-surface catalog-main">
          <div className="store-toolbar"><button>全部类型 <IconChevronDown /></button><button>全部状态 <IconChevronDown /></button><label><IconSearch /><input placeholder="搜索商品或卖点" /></label><button aria-label="筛选"><IconFilter /></button></div>
          <div className="store-table store-table--offers">
            <div className="store-table-head"><span>商品</span><span>类型</span><span>价格</span><span>主打卖点</span><span>适用场景</span><span>库存/可用</span><span>平台展示</span></div>
            {offers.map((item, index) => <div className={`store-table-row ${index === 0 ? 'is-selected' : ''}`} key={item[1]}><span className="media-cell"><img src={item[0]} alt="" /><strong>{item[1]}</strong></span><Status tone={item[2] === '到店套餐' ? 'accent' : 'neutral'}>{item[2]}</Status><strong>¥{item[3]}</strong><span>{item[4]}</span><span>{item[5]}</span><Status tone="good">资料可用</Status><span>待同步</span></div>)}
          </div>
        </section>
        <aside className="store-inspector catalog-editor"><div className="section-title"><h2>商品详情</h2><IconEdit size={17} /></div><img className="editor-photo" src={photos.pour} alt="手冲咖啡示意" /><h3>手冲体验 ¥68</h3><Status tone="warn">平台待同步</Status><label>名称<input value="手冲体验" readOnly /></label><label>类型<input value="到店套餐" readOnly /></label><label>主打卖点<textarea value="精选单品手冲，感受产地风味" readOnly /></label><label>适用场景<input value="咖啡体验、个人放松" readOnly /></label><PrimaryButton>保存资料</PrimaryButton></aside>
      </div>
    </section>
  );
}

const assets = [
  [photos.storefront, '门头 · 白天全景', '实拍', '00:08', '门头'], [photos.interior, '环境 · 靠窗座位区', '实拍', '00:07', '环境'],
  [photos.table, '环境 · 吧台区域', '实拍', '00:06', '环境'], [photos.barista, '店员 · 制作咖啡', '实拍', '00:05', '店员'],
  [photos.pour, '服务过程 · 手冲', '实拍', '00:06', '过程'], [photos.latte, '商品 · 招牌拿铁', '实拍', '00:04', '商品'],
  [photos.cold, '商品 · 冰美式', '实拍', '00:04', '商品'], [photos.pastry, '商品 · 芝士蛋糕', '实拍', '00:03', '商品'],
];

export function StoreAssetsPage() {
  return (
    <section className="store-page" data-testid="store-assets-page">
      <PageHeader eyebrow="门店资产" title="素材与使用权" description="区分门店实拍与 AI 补镜，记录授权范围、来源和使用历史。" action={<PrimaryButton><IconUpload size={17} /> 上传门店素材</PrimaryButton>} />
      <div className="asset-layout">
        <aside className="asset-filters"><h3>资产分类</h3>{['全部资产 128','门头','环境','店员','商品','服务过程','顾客场景'].map((item,index)=><button className={index===0?'is-active':''} key={item}>{item}</button>)}<hr/><h3>生成类型</h3><button>实拍素材</button><button>AI 补镜</button><hr/><h3>使用权</h3><button>已授权</button><button>待补充</button></aside>
        <main className="asset-grid-wrap"><div className="store-toolbar"><label><IconSearch/><input placeholder="搜索素材名称、标签或描述"/></label><button>类型：全部 <IconChevronDown/></button><button>来源：全部 <IconChevronDown/></button><button>最新 <IconChevronDown/></button></div><div className="asset-grid">{assets.map((asset,index)=><article className={index===0?'is-selected':''} key={asset[1]}><div className="asset-thumb"><img src={asset[0]} alt={asset[1]}/><span>{asset[3]}</span></div><div><strong>{asset[1]}</strong><Status tone="good">已授权</Status></div><p>来源：门店拍摄 · {asset[2]}</p><p>拍摄日期：2026-08-{index + 1 < 10 ? `0${index + 1}` : index + 1}</p><footer><span>{asset[4]}</span><span>关联拍摄 S00{index+1}</span></footer></article>)}</div></main>
        <aside className="store-inspector asset-detail"><img src={photos.storefront} alt="已选择素材预览"/><h2>门头 · 白天全景</h2><p className="muted-copy">视频 · 00:08 · 3840×2160</p><section><h3>来源记录</h3><dl className="inspector-list"><div><dt>来源</dt><dd>门店拍摄</dd></div><div><dt>上传者</dt><dd>国贸店 · 店长</dd></div><div><dt>文件指纹</dt><dd>c1b2d3e4… <IconCopy size={13}/></dd></div></dl></section><section><h3>使用权</h3><dl className="inspector-list"><div><dt>使用范围</dt><dd>门店自用 / 线上宣传</dd></div><div><dt>授权期限</dt><dd>至 2027-08-10</dd></div></dl></section><section><h3>使用历史</h3><p className="muted-copy">门店介绍视频 · 探店脚本 A · 发布配置草稿</p></section></aside>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="store-field"><span>{label}</span><div>{children}</div></label>; }

export function AcquisitionCampaignPage() {
  const navigate = useNavigate();
  const projectId = DEMO_PROJECT_ID;
  return (
    <section className="store-page store-page--form" data-testid="store-campaign-page">
      <PageHeader eyebrow="获客任务" title="新建到店探店任务" description="明确平台、人群、预算与转化动作；投放连接未配置前不会创建真实广告。" />
      <div className="campaign-layout"><main className="campaign-form"><div className="campaign-column"><Field label="任务目标"><span><IconTarget/>到店探店视频<IconChevronDown/></span></Field><Field label="目标平台"><div className="choice-row"><button className="is-selected">抖音 <IconCheck/></button><button className="is-selected">快手 <IconCheck/></button><button className="is-selected">小红书 <IconCheck/></button><button>视频号</button></div></Field><Field label="投放范围"><span><IconMapPin/>本地 3km<IconChevronDown/></span></Field><Field label="目标人群"><span><IconUser/>18–35 岁 · 白领/学生 · 喜爱咖啡与探店的人群</span></Field><Field label="内容角度"><span>氛围打卡 · 招牌拿铁 · 店内环境 · 甜品搭配</span></Field></div><div className="campaign-column"><Field label="优惠与利益点"><span>到店套餐</span></Field><Field label="转化动作（CTA）"><span>领取到店券</span></Field><Field label="投放预算"><span>¥ 3,000 <small>预算草稿</small></span></Field><Field label="投放时长"><span>7 天<IconChevronDown/></span></Field><Field label="追踪链接"><span><IconLink/>待配置<IconCopy/></span></Field><Field label="限制条件"><span>仅限本地用户 · 频次控制 · 内容合规审核</span></Field></div><PrimaryButton onClick={()=>navigate(`/projects/${projectId}/script`)} testId="campaign-generate-script"><IconSparkles/>生成探店脚本</PrimaryButton></main><aside className="store-inspector readiness"><div className="section-title"><h2>任务就绪度</h2><strong className="accent-number">84%</strong></div><div className="progress-line"><i style={{width:'84%'}}/></div><ul className="check-list"><li><IconCheck/>目标已明确</li><li><IconCheck/>平台已选择</li><li><IconCheck/>人群已设定</li><li><IconCheck/>预算与时长已填写</li><li className="is-warn"><IconAlertCircle/>追踪链接待配置</li></ul><section><h3>AI 建议</h3><p>建议突出“招牌拿铁 + 环境氛围”，并为通勤人群补充早间内容版本。</p></section><Status tone="warn">真实投放未接通</Status></aside></div>
    </section>
  );
}

const scriptRows = [
  ['开场钩子','00:00–00:03','门店入口与木质招牌，阳光落在玻璃上。','在国贸醒来，藏着一间可以慢下来的咖啡小店。'],
  ['到店指引','00:03–00:12','地铁出口、步行路线与门店外观。','从国贸站 C 口出，步行约三分钟。'],
  ['环境体验','00:12–00:24','靠窗座位、绿植与暖色灯光。','木质桌椅和安静座位，适合阅读或短暂放空。'],
  ['店员服务','00:24–00:36','店员微笑接待并介绍咖啡豆。','店员会耐心推荐豆子与口味。'],
  ['手冲过程','00:36–00:54','注水萃取与咖啡液特写。','看热水缓缓注入，香气也慢慢散开。'],
  ['套餐权益','00:54–01:12','手冲咖啡与甜点组合。','到店套餐资料已引用，发布前仍需人工核验。'],
  ['CTA','01:12–01:18','门店氛围收尾与地址文字。','想找一处角落，不妨先收藏门店地址。'],
];

export function StoreScriptPage() {
  const navigate = useNavigate(); const projectId=useParams().projectId??DEMO_PROJECT_ID;
  return <section className="store-page" data-testid="script-editor-page"><PageHeader eyebrow="AI 探店脚本" title="温暖治愈的精品咖啡体验" description="脚本引用门店事实与套餐资料；AI 产出必须经过人工确认后进入分镜。" action={<PrimaryButton onClick={()=>navigate(`/projects/${projectId}/storyboard`)} testId="script-to-storyboard-btn">生成分镜</PrimaryButton>}/><div className="script-layout"><aside className="script-versions"><div className="section-title"><h3>脚本版本（5）</h3><IconPlus/></div>{['A · 温暖治愈','B · 通勤友好','C · 复古氛围','D · 拿铁爱好者','E · 周末约会'].map((item,index)=><button className={index===0?'is-active':''} key={item}><span>{item}</span><strong>{[92,85,78,74,70][index]}</strong><small>AI 解析完成</small></button>)}<SecondaryButton>新建脚本版本</SecondaryButton></aside><main className="script-editor store-surface"><div className="store-table script-table"><div className="store-table-head"><span>结构</span><span>时长</span><span>画面 / 内容</span><span>旁白 / 文案</span></div>{scriptRows.map((row,index)=><div className="store-table-row" key={row[0]}><Status tone={index===6?'accent':'neutral'}>{row[0]}</Status><span>{row[1]}</span><p>{row[2]}</p><textarea data-testid={index===0?'script-block-content-hook':undefined} value={row[3]} readOnly/></div>)}</div><footer className="editor-footer"><span>总时长 01:18</span><span>建议时长 01:00–01:40</span><span>字数 188 / 300</span></footer></main><aside className="store-inspector"><section><div className="section-title"><h3>事实引用（5）</h3><button>查看全部</button></div><ol className="fact-citations"><li><strong>地址与交通</strong><span>门店档案 · 已核验</span></li><li><strong>营业时间</strong><span>门店档案 · 已核验</span></li><li><strong>店内设施</strong><span>门店实拍 · 已授权</span></li><li><strong>招牌饮品</strong><span>商品套餐 · 待同步</span></li><li><strong>支付方式</strong><span>门店公示 · 已核验</span></li></ol></section><section><h3>风险提醒（2）</h3><p className="risk-line"><IconAlertCircle/>请勿虚构未核实的限量活动。</p><p className="risk-line"><IconAlertCircle/>避免绝对化与效果承诺。</p></section><SecondaryButton>人工确认</SecondaryButton></aside></div></section>;
}

const storyboardRows = [
  ['01',photos.storefront,'门头与位置','平移','在国贸中心，遇见一杯温暖的咖啡。','实拍','00:05'],
  ['02',photos.interior,'进店动线','中景','推开门，香气与音乐迎面而来。','实拍','00:05'],
  ['03',photos.table,'环境氛围','中景','明亮舒适的空间，适合放慢脚步。','实拍','00:06'],
  ['04',photos.barista,'店员服务','近景','用心服务，温暖相伴。','实拍','00:05'],
  ['05',photos.pour,'手冲过程','特写','匠心手冲，专注每一滴。','实拍','00:06'],
  ['06',photos.latte,'招牌饮品','旋转/推进','招牌拿铁，醇香顺滑。','实拍','00:05'],
  ['07',photos.guest,'顾客体验','中景','靠窗阅读，享受轻松时刻。','待补镜','00:06'],
];

export function StoreStoryboardPage(){const navigate=useNavigate();const projectId=useParams().projectId??DEMO_PROJECT_ID;return <section className="store-page" data-testid="store-storyboard-page"><PageHeader eyebrow="探店分镜" title="拍摄清单与镜头状态" description="将已确认脚本拆成可拍镜头，明确实拍来源、缺失镜头与 AI 补镜建议。"/><div className="storyboard-layout"><main className="store-surface storyboard-table"><div className="store-table store-table--story"><div className="store-table-head"><span>镜号</span><span>画面 / 分镜</span><span>景别</span><span>运镜</span><span>旁白 / 画外音</span><span>来源</span><span>时长</span></div>{storyboardRows.map(row=><div className="store-table-row" key={row[0]}><strong>{row[0]}</strong><span className="media-cell"><img src={row[1]} alt=""/><strong>{row[2]}</strong></span><span>{row[3]}</span><span>稳定推进</span><p>{row[4]}</p><Status tone={row[5]==='实拍'?'good':'warn'}>{row[5]}</Status><span>{row[6]}</span></div>)}</div><footer className="storyboard-actions"><SecondaryButton>生成拍摄清单</SecondaryButton><PrimaryButton onClick={()=>navigate(`/projects/${projectId}/rough-cut`)}>进入剪辑</PrimaryButton></footer></main><aside className="store-inspector"><section><div className="section-title"><h3>拍摄进度</h3><strong className="accent-number">71%</strong></div><div className="progress-line"><i style={{width:'71%'}}/></div><dl className="inspector-list"><div><dt>总镜头</dt><dd>7</dd></div><div><dt>已拍摄</dt><dd>5</dd></div><div><dt>待补镜</dt><dd>2</dd></div></dl></section><section><h3>缺失镜头提醒</h3><p className="risk-line"><IconAlertCircle/>缺少顾客使用场景特写</p><p className="risk-line"><IconAlertCircle/>缺少环境细节空镜</p></section><section><div className="section-title"><h3>AI 补镜建议</h3><button>换一批</button></div><div className="suggestion-strip"><img src={photos.table} alt="补镜建议"/><div><strong>环境细节镜</strong><span>建议时长 00:03 · 慢推</span></div><IconPlus/></div><div className="suggestion-strip"><img src={photos.guest} alt="补镜建议"/><div><strong>顾客氛围镜</strong><span>建议时长 00:03 · 中景</span></div><IconPlus/></div></section></aside></div></section>}

export function StoreEditingPage(){const navigate=useNavigate();const projectId=useParams().projectId??DEMO_PROJECT_ID;return <section className="store-page editing-page" data-testid="store-editing-page"><PageHeader eyebrow="剪辑成片" title="9:16 探店粗剪" description="组合分镜、字幕、旁白与 BGM；导出前逐项检查事实、权益和来源链。" action={<PrimaryButton onClick={()=>navigate(`/projects/${projectId}/delivery`)}>导出预览</PrimaryButton>}/><div className="editing-layout"><aside className="clip-list"><div className="section-title"><h3>分镜（7）</h3><IconPlus/></div>{storyboardRows.slice(0,6).map(row=><button key={row[0]}><strong>{row[0]}</strong><img src={row[1]} alt=""/><span>{row[2]}<small>{row[6]}</small></span><IconCircleCheck/></button>)}</aside><main className="video-workspace"><div className="video-preview"><img src={photos.interior} alt="探店视频预览"/><div className="video-title"><strong>拾光咖啡 · 国贸店</strong><span>探店粗剪</span></div><button aria-label="播放"><IconPlayerPlayFilled/></button></div><div className="playbar"><span>00:16 / 00:42</span><div><IconPlayerPlayFilled/></div><span>9:16</span></div><div className="timeline"><div className="timeline-ruler">00:00 <span/>00:10 <span/>00:20 <span/>00:30 <span/>00:42</div><div className="track"><strong>视频轨道</strong>{storyboardRows.slice(0,6).map(row=><img key={row[0]} src={row[1]} alt=""/>)}</div><div className="track track--caption"><strong>字幕轨道</strong><div>国贸商圈的温暖咖啡店</div><div>手冲咖啡，专注每一滴</div></div><div className="track track--voice"><strong>旁白轨道</strong><div/></div><div className="track track--music"><strong>BGM 轨道</strong><div/></div></div></main><aside className="store-inspector editing-inspector"><div className="store-tabs"><button className="is-active">脚本解析</button><button>镜头状态</button><button>导出检查</button></div><section><div className="section-title"><h3>AI 解析完成</h3><strong>7/7</strong></div><ul className="check-list">{scriptRows.map(row=><li key={row[0]}><IconCheck/>{row[0]} · {row[1]}</li>)}</ul></section><section><h3>门店事实 8/8</h3><p className="muted-copy">名称、营业时间、地址、交通、座位、特色、支付与联系方式已引用。</p></section><section><h3>生成补镜</h3><p className="muted-copy">可生成建议镜头草稿；生成结果不会自动标记为门店实拍。</p><SecondaryButton>生成补镜草稿</SecondaryButton></section><Status tone="warn">尚未导出成片</Status></aside></div></section>}

export function PublishDistributionPage(){return <section className="store-page" data-testid="store-publish-page"><PageHeader eyebrow="发布投放" title="多平台适配与发布配置" description="配置标题、POI、CTA、追踪链接和预算；Provider 未接通前仅保存发布草稿。" action={<PrimaryButton>保存发布草稿</PrimaryButton>}/><div className="publish-layout"><main className="publish-main store-surface"><div className="platform-tabs"><button className="is-active">抖音</button><button>快手</button><button>小红书</button><button>视频号</button><button>B站</button></div><div className="publish-editor"><div className="publish-preview"><img src={photos.latte} alt="待发布探店视频预览"/><button aria-label="播放"><IconPlayerPlayFilled/></button><span>00:00 / 00:35 · 9:16</span></div><div className="publish-fields"><Field label="标题"><span>周末和一杯好咖啡，治愈所有疲惫</span></Field><Field label="描述"><span>阳光、咖啡和你。在这家温暖的小店，遇见属于自己的慢时光。</span></Field><Field label="话题标签"><span># 咖啡日常　# 小店探店　# 治愈时光</span></Field><Field label="门店 POI"><span><IconMapPin/>待配置门店 POI</span></Field><Field label="CTA 按钮"><span>领取到店券</span></Field><Field label="追踪链接"><span><IconLink/>待配置</span></Field><Field label="预约发布时间"><span><IconClock/>未设置</span></Field><Field label="投放预算"><span>未设置</span></Field><Field label="状态"><Status tone="warn">待配置 / 待发布</Status></Field></div></div></main><aside className="store-inspector"><section><h2>合规检查</h2><ul className="publish-checks"><li><span>画面清晰度</span><Status tone="good">通过</Status></li><li><span>字幕可读性</span><Status tone="good">通过</Status></li><li><span>内容合规性</span><Status tone="warn">待检测</Status></li><li><span>版权与肖像</span><Status tone="warn">待检测</Status></li><li><span>广告法合规</span><Status tone="warn">待检测</Status></li></ul></section><section><h2>归因与署名配置</h2><dl className="inspector-list"><div><dt>商业合作标识</dt><dd>待确认</dd></div><div><dt>创作者署名</dt><dd>门店账号</dd></div><div><dt>数据归因窗口</dt><dd>待配置</dd></div></dl></section><EmptyData label="平台连接" /></aside></div></section>}

export function GrowthLeadsPage(){return <section className="store-page" data-testid="store-leads-page"><PageHeader eyebrow="线索转化" title="投放归因与到店转化" description="仅展示来自真实平台与门店核销系统的数据；当前连接未配置，不生成模拟业绩。"/><div className="leads-layout"><main><section className="store-surface"><div className="section-title"><div><h2>投放效果概览</h2><p>数据日期：未连接</p></div><div className="inline-filters"><button>全部平台 <IconChevronDown/></button><button>日期范围 <IconChevronDown/></button></div></div><EmptyData label="投放归因数据"/></section><section className="store-surface"><div className="section-title"><div><h2>线索明细</h2><p>曝光、点击、领券、咨询、到店核销与成本将按真实归因链展示。</p></div><label className="search-box"><IconSearch/><input placeholder="搜索线索 ID / 手机号"/></label></div><div className="store-table leads-table"><div className="store-table-head"><span>线索 ID</span><span>来源视频</span><span>平台</span><span>动作</span><span>时间</span><span>状态</span><span>跟进人</span></div></div><EmptyData label="线索明细"/></section></main><aside className="store-inspector"><section><div className="section-title"><h2>转化路径</h2><Status tone="warn">暂无数据</Status></div><ol className="conversion-path"><li><span><IconPlayerPlayFilled/></span><div><strong>视频曝光</strong><p>等待平台归因事件</p></div></li><li><span><IconDownload/></span><div><strong>领券</strong><p>等待权益系统事件</p></div></li><li><span><IconMapPin/></span><div><strong>到店核销</strong><p>等待门店核销事件</p></div></li></ol></section><section><h3>数据接入说明</h3><p className="muted-copy">接通发布平台、追踪链接和门店核销系统后，可查看单条线索的完整转化路径。</p></section><SecondaryButton>查看接入要求</SecondaryButton></aside></div></section>}
