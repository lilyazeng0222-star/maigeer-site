/**
 * build-product-pages.js
 * 
 * 用法: node build-product-pages.js
 * 
 * 功能: 读取 product_detail.html，提取 MACHINES 数据，
 *       为每台设备生成独立静态 HTML 页面到 /products/ 目录
 *       URL 格式: /products/cat-320d.html
 */

const fs   = require('fs');
const path = require('path');

// ── 1. 读取并解析 MACHINES 数据 ───────────────────────────────
const src = fs.readFileSync('product_detail.html', 'utf8');

// 提取 const MACHINES = { ... }; 代码块
const machinesMatch = src.match(/const MACHINES\s*=\s*(\{[\s\S]+?\});\s*function injectProductSchema/);
if (!machinesMatch) {
  console.error('❌ 找不到 MACHINES 对象，请检查 product_detail.html');
  process.exit(1);
}

// 用 Function 安全求值（仅含纯数据，无副作用）
let MACHINES;
try {
  MACHINES = new Function('return ' + machinesMatch[1])();
} catch (e) {
  console.error('❌ 解析 MACHINES 失败:', e.message);
  process.exit(1);
}

console.log(`✅ 找到 ${Object.keys(MACHINES).length} 台设备:`, Object.keys(MACHINES).join(', '));

// ── 2. 提取模板（导航、CSS、页脚等公共部分）─────────────────
// 从原始 HTML 提取 <head> 内的 CSS（去掉 JS 和动态内容）
const headCssMatch = src.match(/<style>([\s\S]*?)<\/style>/);
const headCss = headCssMatch ? headCssMatch[1] : '';

// 提取 header HTML（导航栏，去掉 lang switcher 部分）
const headerMatch = src.match(/<header class="header">([\s\S]*?)<\/header>/);
const headerHtml = headerMatch ? `<header class="header">${headerMatch[1]}</header>` : '';

// 提取 footer HTML
const footerMatch = src.match(/<footer[\s\S]*?<\/footer>/);
const footerHtml = footerMatch ? footerMatch[0] : '';

// 提取 Google Fonts link
const fontsMatch = src.match(/<link[^>]*fonts\.googleapis[^>]*>/g) || [];
const fontsHtml = fontsMatch.join('\n');

// ── 3. 辅助函数：ID → URL slug ────────────────────────────────
const SLUG_MAP = {
  cat320d:   'cat-320d',
  catd7g:    'cat-d7g',
  howo371:   'howo-371',
  cat966h:   'cat-966h',
  cat140k:   'cat-140k',
  catcs683e: 'cat-cs683e',
};
function toSlug(id) {
  if (SLUG_MAP[id]) return SLUG_MAP[id];
  return id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ── 4. 生成单台设备页面 HTML ──────────────────────────────────
function buildPage(m) {
  const BASE    = 'https://www.maigeermachinery.com';
  const slug    = toSlug(m.id);
  const pageUrl = `${BASE}/products/${slug}.html`;
  const WA      = 'https://wa.me/8615382453746';

  // Schema.org Product JSON-LD
  const specMap = {};
  (m.specs || []).forEach(([k, v]) => { specMap[k] = v; });

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": pageUrl + '#product',
    "name": `Used ${m.model} ${m.type}`,
    "description": m.desc,
    "image": [m.img],
    "sku": m.id.toUpperCase(),
    "brand": { "@type": "Brand", "name": m.brand },
    "model": m.model,
    "category": m.type,
    "countryOfOrigin": "CN",
    "condition": "https://schema.org/UsedCondition",
    "additionalProperty": (m.specs || []).map(([name, value]) => ({
      "@type": "PropertyValue",
      "name": name,
      "value": value
    })),
    "offers": {
      "@type": "Offer",
      "url": pageUrl,
      "priceCurrency": "USD",
      "price": "0",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/UsedCondition",
      "seller": { "@id": `${BASE}/#organization` },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": { "@type": "MonetaryAmount", "currency": "USD", "value": "0" },
        "shippingDestination": { "@type": "DefinedRegion", "name": "Worldwide" },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": { "@type": "QuantitativeValue", "minValue": 7,  "maxValue": 14, "unitCode": "DAY" },
          "transitTime":  { "@type": "QuantitativeValue", "minValue": 14, "maxValue": 45, "unitCode": "DAY" }
        }
      }
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home",     "item": `${BASE}/` },
      { "@type": "ListItem", "position": 2, "name": "Products", "item": `${BASE}/products.html` },
      { "@type": "ListItem", "position": 3, "name": `Used ${m.model} ${m.type}`, "item": pageUrl }
    ]
  };

  // 规格表格 HTML
  const specsHtml = (m.specs || []).map(([label, val]) => `
    <div class="spec-item">
      <div class="spec-l">${label}</div>
      <div class="spec-v">${val}</div>
    </div>`).join('');

  // Features HTML
  const featuresHtml = (m.features || []).map(f => `
    <div class="feat-card">
      <div class="feat-ico">${f.ico}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </div>`).join('');

  // WhatsApp 链接
  const waMain     = `${WA}?text=${m.waText}`;
  const waPhotos   = `${WA}?text=Hi+Lilya,+please+send+real+photos+of+${encodeURIComponent(m.titleShort)}.`;
  const waShipping = `${WA}?text=Hi+Lilya,+please+check+shipping+cost+for+${encodeURIComponent(m.titleShort)}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Used ${m.model} ${m.type} for Sale | MAIGEER MACHINERY</title>
<meta name="description" content="${m.desc.substring(0, 155)}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${pageUrl}"/>

<!-- Open Graph -->
<meta property="og:type"        content="website"/>
<meta property="og:title"       content="Used ${m.model} ${m.type} for Sale | MAIGEER MACHINERY"/>
<meta property="og:description" content="${m.desc.substring(0, 200)}"/>
<meta property="og:url"         content="${pageUrl}"/>
<meta property="og:site_name"   content="MAIGEER MACHINERY"/>
<meta property="og:image"       content="${m.img}"/>

<!-- Schema.org -->
<script type="application/ld+json">${JSON.stringify(productSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

${fontsHtml}
<style>
${headCss}
/* 产品详情页专用样式 */
.pd-hero{background:radial-gradient(circle at 80% 10%,rgba(245,180,0,.14),transparent 35%),linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;padding:80px 0 70px}
.pd-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;padding:64px 0}
.pd-img-wrap{border-radius:12px;overflow:hidden;background:#f0f2f5;aspect-ratio:4/3}
.pd-img-wrap img{width:100%;height:100%;object-fit:cover}
.pd-brand{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:20px}
.pd-title{font-size:clamp(36px,4vw,52px);line-height:.95;text-transform:uppercase;color:var(--white);margin-bottom:16px}
.pd-desc{font-size:14px;color:rgba(255,255,255,.78);line-height:1.75;margin-bottom:24px;font-family:"DM Sans",sans-serif}
.specs-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.15);border-radius:10px;overflow:hidden;margin-bottom:24px}
.spec-item{background:rgba(255,255,255,.06);padding:12px 16px}
.spec-l{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:4px}
.spec-v{font-size:14px;font-weight:600;color:#fff}
.pd-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:64px 0}
.feat-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px 24px}
.feat-ico{font-size:28px;margin-bottom:12px}
.feat-card h3{font-family:"Bebas Neue",sans-serif;font-size:20px;color:var(--navy);margin-bottom:8px;letter-spacing:.04em}
.feat-card p{font-size:13px;color:var(--muted);line-height:1.7;font-family:"DM Sans",sans-serif}
.breadcrumb{font-size:12px;color:rgba(255,255,255,.6);margin-bottom:16px;font-weight:600;letter-spacing:.06em}
.breadcrumb a{color:rgba(255,255,255,.6);text-decoration:none}
.breadcrumb a:hover{color:var(--gold)}
.breadcrumb span{color:var(--gold)}
@media(max-width:768px){
  .pd-grid{grid-template-columns:1fr}
  .feat-grid{grid-template-columns:1fr 1fr}
  .specs-grid{grid-template-columns:1fr}
}
@media(max-width:480px){.feat-grid{grid-template-columns:1fr}}
</style>
</head>
<body>

${headerHtml}

<!-- Product Hero -->
<section class="pd-hero">
  <div class="wrap">
    <div class="breadcrumb">
      <a href="/">Home</a> / <a href="/products.html">Products</a> / <span>Used ${m.model} ${m.type}</span>
    </div>
    <div class="pd-grid">
      <div class="pd-img-wrap">
        <img src="${m.img}" alt="Used ${m.titleShort} for sale" loading="eager"/>
      </div>
      <div>
        <div class="pd-brand">${m.brand} · ${m.type}</div>
        <h1 class="pd-title">Used ${m.model}<br>${m.type}</h1>
        <p class="pd-desc">${m.desc}</p>
        <div class="specs-grid">${specsHtml}</div>
        <div class="pd-actions">
          <a class="btn btn-gold" href="${waMain}" target="_blank" rel="noopener">
            <svg viewbox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Get Price &amp; Video
          </a>
          <a class="btn btn-outline" href="${waPhotos}" target="_blank" rel="noopener" style="color:#fff;border-color:rgba(255,255,255,.35)">
            Request Photos
          </a>
          <a class="btn btn-outline" href="${waShipping}" target="_blank" rel="noopener" style="color:#fff;border-color:rgba(255,255,255,.35)">
            Check Shipping
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Features -->
<section class="features-section">
  <div class="wrap">
    <div class="sec-center" style="margin-bottom:8px">
      <span class="sec-tag">Why Choose This Machine</span>
      <h2 class="sec-h">${m.model} <span class="g">Key Features</span></h2>
    </div>
    <div class="feat-grid">${featuresHtml}</div>
  </div>
</section>

<!-- CTA -->
<section class="final-cta">
  <div class="wrap fcta-inner">
    <div>
      <h2>Ready to Buy Used ${m.model}?</h2>
      <p>Contact us on WhatsApp for current price, real photos and working video. Fast response guaranteed.</p>
    </div>
    <a class="btn btn-gold" href="${waMain}" target="_blank" rel="noopener" style="white-space:nowrap">
      WhatsApp Lilya Now
    </a>
  </div>
</section>

${footerHtml}

</body>
</html>`;
}

// ── 5. 写出文件 ───────────────────────────────────────────────
const outDir = path.join('products');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const generatedFiles = [];

for (const [id, m] of Object.entries(MACHINES)) {
  const slug     = toSlug(id);
  const filename = `${slug}.html`;
  const outPath  = path.join(outDir, filename);
  const html     = buildPage(m);

  fs.writeFileSync(outPath, html, 'utf8');
  generatedFiles.push({ id, slug, filename, url: `/products/${filename}` });
  console.log(`✅ 生成: /products/${filename}  ←  ${m.titleShort}`);
}

console.log('\n📋 生成汇总:');
generatedFiles.forEach(f => {
  console.log(`  ${f.url.padEnd(35)} (id=${f.id})`);
});

console.log(`\n✅ 完成！共生成 ${generatedFiles.length} 个静态产品页面到 products/ 目录`);
console.log('\n💡 下一步建议:');
console.log('  1. 将 products/ 目录上传到 Netlify（和其他文件一起）');
console.log('  2. 在 sitemap.xml 中添加这些新 URL');
console.log('  3. 在 products.html 产品列表中将链接改为 /products/cat-320d.html 等');
