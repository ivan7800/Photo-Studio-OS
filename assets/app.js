

/* ──────────────────────────────────────────────────────────────
   v1.2 HARDENED EVENT BRIDGE
   Replaces inline onclick/onchange/oninput/onkeydown handlers with
   data-on* attributes so CSP can run without script-src 'unsafe-inline'.
────────────────────────────────────────────────────────────── */
function splitActionArgs(raw){
  const args=[]; let cur=''; let quote=null; let depth=0;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quote){ cur+=ch; if(ch===quote && raw[i-1] !== '\\') quote=null; continue; }
    if(ch==='\'' || ch==='"'){ quote=ch; cur+=ch; continue; }
    if(ch==='('){ depth++; cur+=ch; continue; }
    if(ch===')'){ depth--; cur+=ch; continue; }
    if(ch===',' && depth===0){ args.push(cur.trim()); cur=''; continue; }
    cur+=ch;
  }
  if(cur.trim()) args.push(cur.trim());
  return args;
}
function parseActionArg(arg,self,event){
  if(arg==='this') return self;
  if(arg==='event') return event;
  if(/^[-+]?\d+(\.\d+)?$/.test(arg)) return Number(arg);
  if(arg==='true') return true;
  if(arg==='false') return false;
  if((arg.startsWith('\'')&&arg.endsWith('\'')) || (arg.startsWith('"')&&arg.endsWith('"'))) return arg.slice(1,-1);
  return arg;
}
function runDeclarativeAction(expr,self,event){
  if(!expr) return;
  expr=String(expr).trim();
  if(expr.startsWith('if(event.target===this)')){
    if(event.target===self) runDeclarativeAction(expr.replace('if(event.target===this)',''),self,event);
    return;
  }
  if(expr.startsWith("if(event.key==='Enter')")){
    if(event.key==='Enter') runDeclarativeAction(expr.replace("if(event.key==='Enter')",''),self,event);
    return;
  }
  expr=expr.replace(/event\.stopPropagation\(\);?/g,()=>{event.stopPropagation();return '';});
  expr=expr.replace(/this\.classList\.toggle\('on'\);?/g,()=>{self.classList.toggle('on');return '';});
  if(expr.includes("el('importFile').click()")){
    const input=typeof el==='function'?el('importFile'):document.getElementById('importFile');
    if(input) input.click();
    expr=expr.replace("el('importFile').click()",'');
  }
  const parts=expr.split(';').map(p=>p.trim()).filter(Boolean);
  for(const part of parts){
    const m=part.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
    if(!m) continue;
    const fn=window[m[1]];
    if(typeof fn!=='function') continue;
    const args=m[2].trim()?splitActionArgs(m[2]).map(a=>parseActionArg(a,self,event)):[];
    fn(...args);
  }
}
function bindDeclarativeEvents(){
  ['click','change','input','keydown'].forEach(type=>{
    document.addEventListener(type,event=>{
      const attr='data-on'+type;
      const target=event.target.closest?.('['+attr+']');
      if(!target) return;
      if(type==='click' && target.disabled) return;
      runDeclarativeAction(target.getAttribute(attr),target,event);
    });
  });
}
function applyDynamicStyles(){
  document.querySelectorAll('[data-bar-width]').forEach(n=>{
    const v=Math.max(0,Math.min(100,Number(n.getAttribute('data-bar-width'))||0));
    n.style.width=v+'%';
  });
}
document.addEventListener('DOMContentLoaded',bindDeclarativeEvents);


/* ══════════════════════════════════════════════════
   PHOTO STUDIO OS v1.5 — CORE ENGINE (POLISHED CONTEXTUAL WARDROBE)
══════════════════════════════════════════════════ */
let activeCat='cotidiana';
let outputLang='es';
let camState={plano:'cuerpo entero, de pies a cabeza',angulo:'ángulo frontal directo',lente:'lente 35mm estilo reportaje natural'};
let liveEnabled=true;
let liveTimer=null;

/* ── DOM helpers ── */
const el=id=>document.getElementById(id);
const val=id=>{const n=el(id);return n?String(n.value||'').trim():''};
const setVal=(id,v)=>{const n=el(id);if(n)n.value=v};
const escapeHTML=t=>String(t??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]||ch));
const escapeAttr=t=>escapeHTML(t).replace(/`/g,'&#96;');
const safeDate=t=>{const d=new Date(t);return isNaN(d.getTime())?new Date():d};
const safeJSON=(key,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch(e){return fallback}};
const safeSessionJSON=(key,fallback={})=>{try{const v=JSON.parse(sessionStorage.getItem(key)||'null');return v??fallback}catch(e){return fallback}};
const clean=t=>String(t||'').trim();
const join=(arr,sep=', ')=>arr.map(clean).filter(Boolean).join(sep);
const sc=t=>{let o=String(t||'').trim();
  o=o.replace(/\s+,/g,',').replace(/,\s*,/g,',').replace(/\s+\./g,'.').replace(/,\s*\./g,'.');
  return o.replace(/\s{2,}/g,' ').trim()};
const pick=(id,cid)=>{const s=val(id);return s==='Custom'?val(cid):s};


/* ── CONTEXTUAL WARDROBE v1.4 ──
   Rewrites wardrobe, shoes and legwear lists according to the selected subject.
   This prevents masculine / neutral / corporate sessions from showing only dresses,
   lingerie and hosiery-heavy defaults. Internal category keys stay stable so old
   presets keep working. */
const WARDROBE_SELECT_IDS=['outfit-cotidiana','outfit-gala','outfit-lenceria','outfit-disfraz','outfit-banyo','outfit-deporte','shoes','jewelry','accessories','legtype','legcolor','transparency','texture','height'];
const ORIGINAL_CONTEXT_HTML={};
const ORIGINAL_CONTEXT_LABELS={};
const CAT_LABELS_DEFAULT={
  cotidiana:'🏠 Casual · Everyday',
  gala:'✨ Formal · Gala',
  lenceria:'🧥 Layering editorial',
  disfraz:'🎭 Character styling',
  banyo:'🏖️ Resort · Swim',
  deporte:'⚡ Sport · Activewear'
};
const CAT_LABELS_FEMALE={
  cotidiana:'🏠 Casa · Cotidiana',
  gala:'✨ Gala · Fiesta',
  lenceria:'🧥 Intimates editorial',
  disfraz:'🎭 Disfraces',
  banyo:'🏖️ Baño · Playa',
  deporte:'⚡ Deportivo'
};
function rememberOriginalContext(){
  WARDROBE_SELECT_IDS.forEach(id=>{
    const n=el(id);
    if(n && !ORIGINAL_CONTEXT_HTML[id]) ORIGINAL_CONTEXT_HTML[id]=n.innerHTML;
    if(n && !ORIGINAL_CONTEXT_LABELS[id]){
      const lb=n.closest('.box')?.querySelector('label');
      ORIGINAL_CONTEXT_LABELS[id]=lb?lb.textContent:'';
    }
  });
}
function selectedSubjectText(){
  const n=el('subjectType');
  return n && n.options[n.selectedIndex] ? n.options[n.selectedIndex].textContent.toLowerCase() : '';
}
function subjectContext(){
  const v=val('subjectType').toLowerCase();
  const t=selectedSubjectText();
  if(v.includes('modelo adulta') || t.includes('femenina')) return 'female';
  if(v === 'modelo adulto' || v.includes('masculino') || t.includes('masculino')) return 'male';
  if(v.includes('no binaria') || t.includes('no binaria')) return 'neutral';
  if(v.includes('corporativo') || t.includes('corporativo')) return 'corporate';
  if(v.includes('artista') || t.includes('artista')) return 'creative';
  if(v.includes('senior') || t.includes('senior')) return 'senior';
  return 'neutral';
}
function htmlOption(item,selectedValue,used){
  const value=Array.isArray(item)?item[0]:item;
  const label=Array.isArray(item)?item[1]:item;
  const selected=selectedValue && value===selectedValue && !used.hit;
  if(selected) used.hit=true;
  return `<option value="${escapeAttr(value)}"${selected?' selected':''}>${escapeHTML(label)}</option>`;
}
function renderGroups(id,groups,selectedValue,fallbackValue){
  const n=el(id); if(!n) return;
  const used={hit:false};
  let html=groups.map(g=>`<optgroup label="${escapeAttr(g.label)}">${g.items.map(it=>htmlOption(it,selectedValue,used)).join('')}</optgroup>`).join('');
  const customSelected=selectedValue==='Custom';
  html+=`<option value="Custom"${customSelected?' selected':''}>Custom</option>`;
  n.innerHTML=html;
  if(selectedValue && !used.hit && !customSelected){
    const extra=document.createElement('option');
    extra.value=selectedValue; extra.textContent=selectedValue; extra.selected=true;
    n.insertBefore(extra,n.firstChild);
  }else if(!selectedValue && fallbackValue){
    n.value=fallbackValue;
  }
}
function setBoxLabel(selectId,text){
  const n=el(selectId); if(!n) return;
  let lb=n.previousElementSibling;
  while(lb && lb.tagName!=='LABEL') lb=lb.previousElementSibling;
  if(!lb) lb=n.closest('.box')?.querySelector('label');
  if(lb) lb.textContent=text;
}
function setCatLabel(cat,text){
  const btn=Array.from(document.querySelectorAll('.cat-tab')).find(b=>(b.getAttribute('data-onclick')||'').includes(`switchCat('${cat}'`));
  if(btn) btn.textContent=text;
}
function setLegSectionTitle(text){
  const sec=Array.from(document.querySelectorAll('.sec')).find(n=>n.textContent.includes('Medias PRO')||n.textContent.includes('Calcetería')||n.textContent.includes('Legwear'));
  if(sec) sec.innerHTML='<span class="sec-n">07</span>'+escapeHTML(text);
}
function setWardrobeHint(ctx){
  const hint=el('wardrobeContextHint'); if(!hint) return;
  const messages={
    female:'Modo femenino: vestidos, layering/intimates editorial, swimwear y medias disponibles como categorías especializadas.',
    male:'Modo masculino: se sustituyen prendas femeninas de nicho por menswear, tailoring, layering, barber, fitness y resort masculino.',
    neutral:'Modo neutro: moda adulta general, andrógina, minimalista y editorial sin sesgo femenino.',
    corporate:'Modo corporativo: business wear, executive portrait, calzado formal y accesorios profesionales.',
    creative:'Modo artista: styling contemporáneo, experimental, editorial y escénico.',
    senior:'Modo senior: retrato adulto premium, prendas elegantes, cómodas y editoriales sin encasillar el género.'
  };
  hint.innerHTML=`<strong>Ropa contextual activa:</strong> ${escapeHTML(messages[ctx]||messages.neutral)}`;
}
function setContextualLabels(ctx){
  const female=ctx==='female';
  const labels=female?CAT_LABELS_FEMALE:CAT_LABELS_DEFAULT;
  Object.entries(labels).forEach(([cat,label])=>setCatLabel(cat,label));
  if(ctx==='male'){
    setBoxLabel('outfit-cotidiana','Menswear casual · everyday');
    setBoxLabel('outfit-gala','Menswear formal · gala');
    setBoxLabel('outfit-lenceria','Layering editorial masculino');
    setBoxLabel('outfit-disfraz','Character styling masculino');
    setBoxLabel('outfit-banyo','Resort · swim masculino');
    setBoxLabel('outfit-deporte','Sportswear masculino');
    setBoxLabel('shoes','Calzado masculino');
    setBoxLabel('jewelry','Joyería / relojería');
    setBoxLabel('accessories','Complementos masculinos');
    setBoxLabel('legtype','Calcetería');
    setBoxLabel('legcolor','Color calcetería');
    setLegSectionTitle('Calcetería / piernas');
  }else if(ctx==='corporate'){
    setBoxLabel('outfit-cotidiana','Ropa business · executive');
    setBoxLabel('outfit-gala','Formal corporativo');
    setBoxLabel('outfit-lenceria','Layering profesional');
    setBoxLabel('outfit-disfraz','Roles profesionales');
    setBoxLabel('outfit-banyo','Resort corporativo');
    setBoxLabel('outfit-deporte','Athleisure ejecutivo');
    setBoxLabel('shoes','Calzado business');
    setBoxLabel('jewelry','Joyería / reloj');
    setBoxLabel('accessories','Complementos profesionales');
    setBoxLabel('legtype','Calcetería');
    setBoxLabel('legcolor','Color calcetería');
    setLegSectionTitle('Calcetería / piernas');
  }else if(ctx==='female'){
    WARDROBE_SELECT_IDS.forEach(id=>setBoxLabel(id,ORIGINAL_CONTEXT_LABELS[id]||''));
    setLegSectionTitle('Medias PRO');
  }else{
    setBoxLabel('outfit-cotidiana','Ropa casual · editorial');
    setBoxLabel('outfit-gala','Formal · gala editorial');
    setBoxLabel('outfit-lenceria','Layering editorial');
    setBoxLabel('outfit-disfraz','Character styling');
    setBoxLabel('outfit-banyo','Resort · swim');
    setBoxLabel('outfit-deporte','Activewear · sport');
    setBoxLabel('shoes','Calzado');
    setBoxLabel('jewelry','Joyería / accesorios finos');
    setBoxLabel('accessories','Complementos');
    setBoxLabel('legtype','Legwear / calcetería');
    setBoxLabel('legcolor','Color legwear');
    setLegSectionTitle('Legwear / calcetería');
  }
}
const WARDROBE_CONTEXTS={
  neutral:{
    outfitCotidiana:[{label:'── Minimal / editorial ──',items:['camisa blanca oversize y pantalón recto','blazer oversize con camiseta premium y pantalón sastre','jersey fino de cuello alto con pantalón amplio','chaqueta denim premium y pantalón negro recto','gabardina ligera sobre conjunto minimal','camiseta negra premium y pantalón de pinzas','mono utilitario minimalista','conjunto de lino relajado y elegante']},{label:'── Lifestyle adulto ──',items:['loungewear premium de punto suave','sudadera premium estructurada con pantalón ancho','camisa fluida con vaqueros rectos','chaqueta bomber minimal con pantalón técnico','cardigan largo con pantalón de lana fina']}],
    outfitGala:[{label:'── Formal andrógino ──',items:['traje sastre negro minimalista','smoking contemporáneo con camisa blanca','traje crema de lino premium','blazer satinado con pantalón wide-leg','conjunto monocromo de gala','chaqueta estructurada con pantalón palazzo','traje cruzado de corte editorial']}],
    outfitLayer:[{label:'── Layering editorial ──',items:['tank top premium bajo blazer abierto','camisa de seda bajo chaqueta estructurada','top minimal de cuello alto bajo americana','body editorial cubierto con blazer oversize','camiseta interior premium con camisa abierta','chaleco sastre sobre camiseta blanca']}],
    outfitRole:[{label:'── Profesiones / personaje ──',items:['estilismo de arquitecto creativo con americana negra','look de galerista de arte con traje minimal','personaje noir con gabardina y sombrero','look de músico de estudio con chaqueta vintage','estilismo de director creativo con gafas y libreta','look de chef editorial con chaqueta blanca premium']}],
    outfitBanyo:[{label:'── Resort neutral ──',items:['camisa de lino abierta sobre bañador discreto','short resort de lino con camisa ligera','kaftán minimal de playa','conjunto resort de algodón blanco','rashguard premium con short de baño','look spa con albornoz blanco premium']}],
    outfitDeporte:[{label:'── Activewear neutral ──',items:['conjunto técnico minimal de entrenamiento','sudadera técnica y joggers premium','chaqueta running ligera con pantalón técnico','look yoga adulto de tejido suave','set athleisure monocromo','polo técnico con pantalón sport elegante']}],
    shoes:[{label:'── Casual / formal ──',items:['mocasines elegantes de cuero pulido','zapatillas premium blancas minimalistas','botines Chelsea de cuero negro','zapatos Oxford negros','derbies de cuero marrón','slippers tipo loafer de cuero','sandalias minimalistas de cuero','sin calzado visible']}],
    jewelry:[{label:'── Accesorios finos ──',items:[['','Sin joyería'],'reloj clásico de acero','reloj minimalista negro','cadena fina plateada','anillo minimalista de plata','pulsera de cuero fina','joyería minimalista dorada']}],
    accessories:[{label:'── Complementos ──',items:[['','Sin complemento'],'gafas de sol de diseño clásico','gafas discretas graduadas','bolso tote de cuero minimal','maletín creativo de cuero','pañuelo de seda al cuello','libro abierto en mano','taza de café en mano']}],
    legtype:[{label:'── Calcetería ──',items:['sin medias visibles','calcetines invisibles','calcetines de vestir finos','calcetines deportivos blancos premium','calcetines negros minimalistas','calcetines de lana fina']}],
    legcolor:[{label:'── Color ──',items:[['sin color específico','sin color específico'],['negras','negras'],['blancas','blancas'],['gris humo','gris humo'],['azul noche','azul noche'],['marrones','marrones']]}]
  },
  male:{
    outfitCotidiana:[{label:'── Casual premium ──',items:['camisa Oxford blanca y pantalón chino','camiseta blanca premium con vaqueros rectos','jersey de cuello alto negro con pantalón sastre','chaqueta de cuero negra y camiseta minimalista','sobrecamisa de lana con pantalón recto','polo de punto fino con pantalón de pinzas','camisa de lino clara y pantalón elegante','cardigan de cashmere con camiseta blanca']},{label:'── Street / lifestyle ──',items:['bomber premium con joggers estructurados','chaqueta denim oscura con camiseta negra','gabardina beige sobre look monocromo','sudadera minimalista de lujo con pantalón técnico']}],
    outfitGala:[{label:'── Trajes / tailoring ──',items:['traje italiano azul marino con camisa blanca','smoking negro clásico con pajarita','traje cruzado gris antracita','traje beige de lino premium','traje negro minimalista estilo editorial','blazer de terciopelo con pantalón negro','traje tres piezas con chaleco','americana blanca de gala con pantalón negro']}],
    outfitLayer:[{label:'── Layering masculino ──',items:['camiseta interior blanca premium bajo blazer abierto','camisa negra abierta sobre camiseta minimalista','chaleco sastre sobre camisa blanca','tank top deportivo premium bajo chaqueta de cuero','camisa de seda negra con cuello abierto','jersey fino bajo americana estructurada']}],
    outfitRole:[{label:'── Roles masculinos editoriales ──',items:['detective noir con gabardina y sombrero','piloto vintage con cazadora de cuero','profesor elegante con americana de tweed','médico editorial con bata blanca premium','abogado de poder con traje oscuro','barbero clásico con chaleco y camisa','explorador urbano con chaqueta técnica','músico rock con chaqueta de cuero']}],
    outfitBanyo:[{label:'── Resort masculino ──',items:['short de baño premium con camisa de lino abierta','bañador tipo boxer elegante','short resort blanco con polo de lino','look spa con albornoz blanco premium','rashguard negro premium con short deportivo','camisa resort estampada y bermuda de lino']}],
    outfitDeporte:[{label:'── Sportswear masculino ──',items:['conjunto training premium camiseta técnica y joggers','camiseta compression negra con pantalón deportivo','look running con chaqueta cortavientos y shorts','ropa de boxeo editorial con bata deportiva','outfit de tenis con polo blanco y shorts','activewear de gimnasio monocromo','equipación cycling premium minimalista']}],
    shoes:[{label:'── Hombre formal / casual ──',items:['zapatos Oxford negros pulidos','derbies marrones de cuero','mocasines penny de cuero','botines Chelsea negros','botas worker premium','zapatillas blancas minimalistas','zapatillas deportivas premium negras','sandalias de cuero masculinas','sin calzado visible']}],
    jewelry:[{label:'── Relojería / joyería masculina ──',items:[['','Sin joyería'],'reloj clásico de acero','reloj deportivo premium','cadena fina de plata','anillo signet discreto','pulsera de cuero negro','gemelos plateados discretos']}],
    accessories:[{label:'── Complementos masculinos ──',items:[['','Sin complemento'],'gafas de sol aviador','gafas graduadas de montura negra','maletín de cuero elegante','reloj visible en muñeca','pañuelo de bolsillo discreto','sombrero fedora noir','taza de café en mano','libro cerrado en mano']}],
    legtype:[{label:'── Calcetines ──',items:['sin medias visibles','calcetines de vestir negros','calcetines de vestir azul marino','calcetines invisibles','calcetines deportivos blancos premium','calcetines de lana gris fina']}],
    legcolor:[{label:'── Color ──',items:[['sin color específico','sin color específico'],['negras','negras'],['azul noche','azul noche'],['gris humo','gris humo'],['blancas','blancas'],['marrones','marrones']]}]
  },
  corporate:{
    outfitCotidiana:[{label:'── Executive portrait ──',items:['traje sastre ejecutivo con camisa blanca','blazer azul marino y pantalón formal','americana gris con camisa Oxford','conjunto business casual premium','jersey de cuello alto bajo blazer','camisa blanca impecable con pantalón de pinzas','traje pantalón minimalista de oficina']}],
    outfitGala:[{label:'── Formal business ──',items:['smoking corporativo de gala','traje negro formal de evento','traje azul noche con camisa blanca','blazer de terciopelo discreto con pantalón formal','conjunto de gala sobrio para evento empresarial']}],
    outfitLayer:[{label:'── Layering profesional ──',items:['camisa blanca bajo blazer estructurado','chaleco sastre con camisa premium','jersey fino bajo americana ejecutiva','top o camiseta premium bajo blazer cerrado','gabardina sobre traje ejecutivo']}],
    outfitRole:[{label:'── Roles profesionales ──',items:['CEO en traje oscuro con postura segura','arquitecto con americana negra y planos','abogado con traje formal y maletín','consultor creativo con blazer y libreta','directivo tech con look business casual premium']}],
    outfitBanyo:[{label:'── Resort business ──',items:['look resort de lino premium para viaje corporativo','camisa de lino y pantalón blanco en terraza de hotel','polo premium con pantalón chino claro','albornoz de spa de hotel ejecutivo']}],
    outfitDeporte:[{label:'── Athleisure ejecutivo ──',items:['polo técnico premium y pantalón sport','chaqueta deportiva minimal y joggers estructurados','look golf ejecutivo con polo y pantalón chino','activewear monocromo sobrio de gimnasio']}],
    shoes:[{label:'── Business shoes ──',items:['zapatos Oxford negros pulidos','mocasines de cuero pulido','derbies marrones elegantes','botines Chelsea negros','zapatillas premium blancas minimalistas','tacón bajo cómodo y elegante','zapatos negros cerrados elegantes','sin calzado visible']}],
    jewelry:[{label:'── Accesorios business ──',items:[['','Sin joyería'],'reloj clásico de acero','reloj dorado discreto','pendientes pequeños minimalistas','gemelos plateados discretos','anillo minimalista','joyería minimalista plateada']}],
    accessories:[{label:'── Complementos profesionales ──',items:[['','Sin complemento'],'maletín de cuero elegante','tablet fina en mano','gafas graduadas discretas','bolígrafo premium en mano','carpeta de documentos','taza de café en mano','reloj visible en muñeca']}],
    legtype:[{label:'── Calcetería ──',items:['sin medias visibles','calcetines de vestir negros','calcetines de vestir azul marino','pantyhose completas','medias nude ultra finas efecto invisible']}],
    legcolor:[{label:'── Color ──',items:[['sin color específico','sin color específico'],['negras','negras'],['azul noche','azul noche'],['nude efecto natural','nude efecto natural'],['gris humo','gris humo']]}]
  },
  creative:{
    outfitCotidiana:[{label:'── Creative studio ──',items:['chaqueta oversize de diseño y pantalón oscuro','look monocromo negro con piezas estructuradas','camisa estampada artística y pantalón amplio','kimono contemporáneo sobre conjunto minimal','chaqueta vintage con camiseta gráfica premium','gabardina larga con botas editoriales']}],
    outfitGala:[{label:'── Art gala ──',items:['traje de gala experimental con silueta arquitectónica','conjunto avant-garde negro estructurado','blazer satinado oversize con pantalón fluido','look de alfombra roja artístico y minimal','conjunto de galería con textura escultórica']}],
    outfitLayer:[{label:'── Experimental layering ──',items:['top minimal bajo chaqueta escultórica','camisa transparente editorial bajo blazer cerrado','chaleco de diseño sobre camiseta negra','capas de tejido técnico con volumen controlado','body o base layer cubierto por chaqueta oversize']}],
    outfitRole:[{label:'── Personaje artístico ──',items:['pintor contemporáneo con mono de trabajo premium','músico experimental con chaqueta vintage','director de cine con gabardina oscura','performer teatral con abrigo largo','diseñador de moda con look avant-garde']}],
    outfitBanyo:[{label:'── Resort artístico ──',items:['kaftán artístico sobre look resort','camisa resort estampada con short minimal','conjunto blanco de lino con silueta amplia','albornoz de spa con textura premium']}],
    outfitDeporte:[{label:'── Movement / performance ──',items:['activewear experimental monocromo','ropa de danza contemporánea de tejido fluido','conjunto técnico minimal para movimiento','sudadera oversize con joggers de diseño']}],
    shoes:[{label:'── Footwear creativo ──',items:['botines negros de diseño','zapatillas de diseñador minimalistas','mocasines chunky de cuero','botas altas editoriales','sandalias de diseño minimal','sin calzado visible']}],
    jewelry:[{label:'── Statement pieces ──',items:[['','Sin joyería'],'collar bold statement','anillo escultórico grande','pendientes geométricos','cadena plateada gruesa','joyería minimalista negra']}],
    accessories:[{label:'── Props creativos ──',items:[['','Sin complemento'],'cuaderno de artista en mano','cámara analógica colgada','gafas de diseño','pincel o carboncillo en mano','libro de arte abierto','bufanda larga de textura premium']}],
    legtype:[{label:'── Legwear creativo ──',items:['sin medias visibles','calcetines negros minimalistas','calcetines artísticos con patrón sutil','medias opacas 80D','pantyhose completas']}],
    legcolor:[{label:'── Color ──',items:[['sin color específico','sin color específico'],['negras','negras'],['gris humo','gris humo'],['blancas','blancas'],['azul noche','azul noche']]}]
  },
  senior:{
    outfitCotidiana:[{label:'── Senior premium ──',items:['americana de lino clara y pantalón elegante','camisa de lino suave y pantalón claro','jersey de cashmere con pantalón sastre','blusa o camisa de seda con pantalón palazzo','chaqueta de tweed con pantalón recto','vestido camisero elegante de lino','conjunto de punto premium cómodo y refinado']}],
    outfitGala:[{label:'── Gala senior premium ──',items:['traje sastre de gala con caída elegante','vestido largo sobrio de seda natural','smoking blanco o negro de corte clásico','conjunto palazzo de seda con chaqueta ligera','vestido midi de gala con manga francesa','blazer de terciopelo con pantalón formal']}],
    outfitLayer:[{label:'── Layering elegante ──',items:['camisa de seda bajo blazer suave','top discreto con chal de cachemira','jersey fino bajo americana de lino','base layer premium con chaqueta larga','camiseta de algodón pima bajo cardigan de cashmere']}],
    outfitRole:[{label:'── Retrato con carácter ──',items:['escritora senior con chal y libro','directiva senior con traje impecable','artista senior con chaqueta de lino','profesor senior con americana de tweed','viajera elegante con gabardina clara']}],
    outfitBanyo:[{label:'── Resort senior ──',items:['bañador entero elegante con pareo de lino','kaftán premium sobre bañador discreto','camisa de lino blanca y pantalón resort','albornoz de spa de hotel lujo','look de terraza mediterránea con lino claro']}],
    outfitDeporte:[{label:'── Wellness senior ──',items:['conjunto wellness de tejido suave','ropa de yoga cómoda y premium','polo técnico y pantalón sport elegante','chándal premium de punto fino','activewear senior sobrio y cómodo']}],
    shoes:[{label:'── Calzado elegante cómodo ──',items:['mocasines elegantes de cuero pulido','tacón bajo cómodo y elegante','zapatos negros cerrados elegantes','zapatillas premium blancas minimalistas','sandalias elegantes de tiras finas','botines de cuero con tacón bajo','sin calzado visible']}],
    jewelry:[{label:'── Joyería clásica ──',items:[['','Sin joyería'],'collar de perlas clásico','reloj clásico dorado en muñeca','pendientes de perla clásicos','joyería minimalista plateada','pulsera de oro discreta','anillo de piedra grande tipo cóctel']}],
    accessories:[{label:'── Complementos elegantes ──',items:[['','Sin complemento'],'gafas graduadas discretas','pañuelo de seda al cuello','chal de cachemira sobre hombros','libro abierto en mano','bolso de mano de cuero elegante','sombrero de ala ancha elegante']}],
    legtype:[{label:'── Legwear opcional ──',items:['sin medias visibles','pantyhose completas','medias nude ultra finas efecto invisible','medias opacas 40D','calcetines de vestir finos']}],
    legcolor:[{label:'── Color ──',items:[['sin color específico','sin color específico'],['nude efecto natural','nude efecto natural'],['negras','negras'],['marrones','marrones'],['gris humo','gris humo']]}]
  }
};
function getWardrobeConfig(ctx){return WARDROBE_CONTEXTS[ctx]||WARDROBE_CONTEXTS.neutral;}
function applySubjectContext(options={}){
  rememberOriginalContext();
  const ctx=subjectContext();
  const previous=window._lastSubjectContext;
  const changed=previous!==ctx;
  const preserve=options.preserveValues===true && !changed;
  const old={};
  WARDROBE_SELECT_IDS.forEach(id=>old[id]=preserve?val(id):'');
  if(ctx==='female'){
    WARDROBE_SELECT_IDS.forEach(id=>{if(el(id)&&ORIGINAL_CONTEXT_HTML[id]) el(id).innerHTML=ORIGINAL_CONTEXT_HTML[id];});
  }else{
    const c=getWardrobeConfig(ctx);
    renderGroups('outfit-cotidiana',c.outfitCotidiana,old['outfit-cotidiana'],c.outfitCotidiana[0].items[0]);
    renderGroups('outfit-gala',c.outfitGala,old['outfit-gala'],c.outfitGala[0].items[0]);
    renderGroups('outfit-lenceria',c.outfitLayer,old['outfit-lenceria'],c.outfitLayer[0].items[0]);
    renderGroups('outfit-disfraz',c.outfitRole,old['outfit-disfraz'],c.outfitRole[0].items[0]);
    renderGroups('outfit-banyo',c.outfitBanyo,old['outfit-banyo'],c.outfitBanyo[0].items[0]);
    renderGroups('outfit-deporte',c.outfitDeporte,old['outfit-deporte'],c.outfitDeporte[0].items[0]);
    renderGroups('shoes',c.shoes,old.shoes,c.shoes[0].items[0]);
    renderGroups('jewelry',c.jewelry,old.jewelry,'');
    renderGroups('accessories',c.accessories,old.accessories,'');
    renderGroups('legtype',c.legtype,old.legtype,'sin medias visibles');
    renderGroups('legcolor',c.legcolor,old.legcolor,'sin color específico');
  }
  setContextualLabels(ctx);
  setWardrobeHint(ctx);
  if(changed || options.forceLegDefaults){
    if(ctx==='female'){
      setVal('legmode','on');
      if(!val('legtype') || val('legtype')==='sin medias visibles') setVal('legtype','medias thigh-high');
      if(!val('legcolor') || val('legcolor')==='sin color específico') setVal('legcolor','marrones');
    }else{
      setVal('legmode','off');
      setVal('legtype','sin medias visibles');
      if(!val('legcolor')) setVal('legcolor','sin color específico');
    }
  }
  window._lastSubjectContext=ctx;
  updateOutfitSwatch();updateOutfitSwatch2();updateLegSwatch();checkFilterRisk();
}
function isSockLikeLegwear(type){
  return /calcetines|sock|calcetería/i.test(String(type||''));
}

/* ── CATEGORY SWITCH ── */
function switchCat(cat,btn){
  activeCat=cat;
  document.querySelectorAll('.outfit-panel').forEach(p=>p.classList.remove('active'));
  el('cat-'+cat).classList.add('active');
  document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  generate();
}

/* ── CAM PILLS ── */
function setPill(field,value,btn){
  camState[field]=value;
  btn.closest('.cam-pills').querySelectorAll('.cam-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  generate();
}

/* ── LANG ── */
function setLang(l){
  outputLang=l;
  el('langES').classList.toggle('active',l==='es');
  el('langEN').classList.toggle('active',l==='en');
  generate();
}

/* ── SWATCHES ── */
function getSwatch(selectId){
  const n=el(selectId);if(!n)return null;
  const opt=n.options[n.selectedIndex];
  return opt?opt.getAttribute('data-hex'):null;
}
function updateSwatch(swatchId,labelId,selectId){
  const hex=getSwatch(selectId);
  if(hex&&hex!==''){el(swatchId).style.background=hex;el(swatchId).style.opacity='1';}
  else{el(swatchId).style.background='#333';el(swatchId).style.opacity='.25';}
  const n=el(selectId);
  el(labelId).textContent=n&&n.selectedIndex>0?n.options[n.selectedIndex].text:'—';
}
function updateTonoPielSwatch(){
  const sel=el('tonoPiel');
  const sw=el('tonoPielSwatch');
  const lb=el('tonoPielSwatchLabel');
  if(!sel||!sw)return;
  const opt=sel.options[sel.selectedIndex];
  const hex=opt?opt.getAttribute('data-hex'):'';
  const label=opt?opt.text.trim():'—';
  if(sw) sw.style.background=hex||'#c07850';
  if(lb) lb.textContent=hex?label:'—';
}
function updateHairSwatch(){updateSwatch('hairSwatch','hairSwatchLabel','hairColor')}
function updateLipSwatch(){updateSwatch('lipSwatch','lipSwatchLabel','lipColor')}
function updateOutfitSwatch(){updateSwatch('outfitSwatch','outfitSwatchLabel','outfitColor')}
function updateOutfitSwatch2(){updateSwatch('outfitSwatch2','outfitSwatchLabel2','outfitColor2')}
function updateSkinSwatch(){
  const sel=el('skinTone');if(!sel)return;
  const opt=sel.options[sel.selectedIndex];
  const hex=opt?opt.getAttribute('data-hex'):'';
  const sw=el('skinSwatch');const lb=el('skinSwatchLabel');
  if(sw) sw.style.background=hex||'#c8a07a';
  if(lb) lb.textContent=opt&&opt.text?opt.text.trim():'—';
}
function updateLegSwatch(){updateSwatch('legSwatch','legSwatchLabel','legcolor')}

/* ── SENSUAL UI ── */
function updateEditorialUI(){
  const s=val('sensual');
  const badge=el('sbadge');
  el('intensityBar').querySelectorAll('.pip').forEach(p=>{p.className='pip'});
  const maps={off:[0,'sb0','Neutro'],soft:[1,'sb1','Elegante'],medium:[2,'sb2','Editorial'],high:[4,'sb3','Intenso']};
  const [count,cls,label]=maps[s]||maps.soft;
  badge.className='sbadge '+cls;badge.textContent=label;
  const pips=el('intensityBar').querySelectorAll('.pip');
  const pipCls=s==='high'||s==='medium'?'pip pip-rose':'pip pip-gold';
  for(let i=0;i<count;i++)if(pips[i])pips[i].className=pipCls;
}

/* ── OUTFIT RESOLVER ── */
function getOutfit(){
  const colorMain=val('outfitColor');
  const color2=val('outfitColor2');
  const pattern=val('outfitPattern');
  const fabric=val('outfitFabric');
  const colorSuffix=join([colorMain,color2,pattern,fabric],' ');

  let base='';
  switch(activeCat){
    case 'cotidiana':{
      base=pick('outfit-cotidiana','customOutfit-cotidiana')||'vestido elegante';
      const det=val('outfitDetail');
      if(det) base+=' '+det;
      break;}
    case 'gala':{
      base=pick('outfit-gala','customOutfit-gala')||'vestido de noche';
      const det=val('galaDetail');
      if(det) base+=' '+det;
      break;}
    case 'lenceria':{
      base=pick('outfit-lenceria','customOutfit-lenceria')||'bodysuit de encaje';
      const layer=val('lenceriaLayer');
      if(layer) base+=', '+layer;
      break;}
    case 'disfraz':{
      const fit=val('disfrazFit');
      const prop=val('disfrazProp');
      base=join([pick('outfit-disfraz','customOutfit-disfraz'),fit,prop]);
      break;}
    case 'banyo':
      base=pick('outfit-banyo','customOutfit-banyo')||'bañador elegante';
      break;
    case 'deporte':
      base=pick('outfit-deporte','customOutfit-deporte')||'conjunto deportivo';
      break;
  }
  return colorSuffix ? base+' '+colorSuffix : base;
}

function getCatScene(){
  if(activeCat==='banyo'){const s=val('banyoScene');if(s)return s;}
  if(activeCat==='deporte'){const s=val('deporteScene');if(s)return s;}
  return pick('scene','customScene')||'interior luminoso';
}
function getCatAcc(){
  if(activeCat==='banyo') return val('banyoAcc');
  if(activeCat==='deporte') return val('deporteAcc');
  return '';
}

/* ── HAIR ── */
function getHair(){
  const style=val('hairStyle');
  const color=val('hairColor');
  const finish=val('hairFinish');
  const acc=val('hairAcc');
  return join([style,color,finish,acc]);
}

/* ── MAKEUP ── */
function getMakeup(){
  const look=val('makeupLook');
  const lip=val('lipColor');
  const eye=val('eyeMakeup');
  const skin=val('skinLook');
  const parts=[look];
  if(lip&&!look.includes('labios'))parts.push(lip);
  if(eye&&!look.includes('ojos'))parts.push(eye);
  if(skin)parts.push(skin);
  return join(parts);
}

/* ── LEGWEAR ── */
function legwear(){
  if(val('legmode')==='off') return '';
  if(val('legtype')==='Custom') return val('customLegwear');
  const t=val('legtype');
  if(t==='sin medias visibles') return '';
  const skip=['sin color específico','sin detalle extra'];
  if(isSockLikeLegwear(t)) return join([t,val('legcolor')].filter(x=>!skip.includes(x)),' ');
  return join([t,val('legcolor'),val('transparency'),val('texture'),val('height')].filter(x=>!skip.includes(x)),' ');
}

/* ── FOOT PROTECTION — evitar bug de dedos con medias ── */
function footProtection(){
  if(val('legmode')==='off') return '';
  const type=val('legtype');
  if(!type||type==='sin medias visibles'||type==='Custom'||isSockLikeLegwear(type)) return '';
  const shoes=val('shoes')||val('customShoes')||'';
  // Calzado que deja los pies o dedos visibles
  const exposedFoot=
    shoes.includes('descalza')||
    shoes.includes('zapatillas de casa cerradas por delante y abiertas por detrás')||
    shoes.includes('pantuflas')||
    shoes.includes('zapatillas tipo hotel')||
    shoes.includes('sandalias')||
    shoes.includes('mules')||
    shoes.includes('sin calzado')||
    shoes==='';
  if(!exposedFoot) return '';
  const isPantyhose=
    type.includes('pantyhose')||
    type.includes('80D')||
    type.includes('40D')||
    type.includes('ultra finas')||
    type.includes('nude ultra')||
    type.includes('efecto invisible');
  const isThighHigh=
    type.includes('thigh-high')||
    type.includes('altas clásicas')||
    type.includes('banda superior');
  const isShort=
    type.includes('rodilla')||
    type.includes('pantorrilla')||
    type.includes('tobillo');
  if(isPantyhose){
    // Pantyhose cubre los dedos — decirle al modelo que los cubra
    return 'medias cubriendo completamente los pies y dedos de los pies, punta del pie cubierta por tejido de media, sin dedos de los pies al descubierto, pies envueltos en tejido de media';
  }
  if(isThighHigh||isShort){
    // Thigh-high o medias cortas no cubren los pies — forzar naturalidad
    return 'pies y dedos de los pies anatómicamente correctos y naturales, dedos bien formados sin deformidades ni artefactos, pies realistas sin errores';
  }
  return 'pies y dedos de los pies anatómicamente correctos, sin artefactos en los dedos';
}
function fixLegCoherence(){
  const t=val('legtype');
  if(t==='sin medias visibles'){setVal('legmode','off');return}
  if(isSockLikeLegwear(t)){setVal('height','altura tobillo');setVal('texture','sin detalle extra');return}
  if(t.includes('pantyhose')||t.includes('80D')||t.includes('40D'))setVal('height','altura completa');
  if(t.includes('thigh-high')||t.includes('altas')||t.includes('banda superior'))setVal('height','altura muslo');
  if(t.includes('rodilla'))setVal('height','altura rodilla');
  if(t.includes('pantorrilla'))setVal('height','altura media pantorrilla');
  if(t.includes('tobillo'))setVal('height','altura tobillo');
  if(t.includes('rejilla'))setVal('texture','rejilla fina editorial');
  if(t.includes('costura'))setVal('texture','costura trasera discreta');
  if(t.includes('velvet'))setVal('texture','efecto velvet suave');
}

/* ── SAFETY ── */
function safetyText(){
  const s=val('safe');
  if(s==='off') return '';
  if(s==='strict') return 'fotografía editorial, estética elegante, no explícito';
  return 'estética editorial adulta, imagen editorial no explícita';
}

/* ── ADULT-ONLY VALIDATION ── */
function ageNumberFromText(t){
  const m=String(t||'').match(/\d{1,3}/);
  return m?parseInt(m[0],10):null;
}
function validateAdultOnly(){
  const n=ageNumberFromText(ageText());
  if(n!==null && n<18){
    alert('Bloqueado: esta app solo permite sujetos adultos. Usa una edad adulta real.');
    return false;
  }
  const fields=['customAge','customEtnia','customOutfit-cotidiana','customOutfit-gala','customOutfit-lenceria','customOutfit-disfraz','customOutfit-banyo','customOutfit-deporte','customScene','customAction','customStyle'];
  const combined=fields.map(id=>val(id)).join(' ').toLowerCase();
  if(/(^|\b)(niñ|menor|adolescente|teen|child|underage|schoolgirl|colegiala|infantil)(\b|$)/i.test(combined)){
    alert('Bloqueado: se han detectado términos de menor de edad. Mantén el proyecto en sujetos adultos 18+.');
    return false;
  }
  return true;
}

/* ── PERSON ── */
function ageText(){return val('age')==='Custom'?(val('customAge')||'35 años'):val('age')}
function ageRealismText(){
  const m=val('ageRealism');
  const n=ageNumberFromText(ageText());
  if(m==='premium') return n!==null && n>=60
    ? 'rasgos senior elegantes, piel realista con textura natural, manos y cuello acordes a la edad'
    : 'rasgos editoriales realistas, piel natural con textura visible, manos coherentes';
  if(m==='real') return 'rasgos naturales acordes a la edad seleccionada, textura real de piel, manos realistas';
  return 'rasgos naturales acordes a la edad seleccionada, piel con textura realista';
}
function sensualText(){
  const s=val('sensual');
  if(s==='high') return 'presencia editorial intensa, actitud segura, elegancia adulta no explícita';
  if(s==='medium') return 'actitud editorial segura, presencia elegante y sofisticada, no explícito';
  if(s==='soft') return 'actitud natural y elegante, presencia cuidada y atractiva';
  return '';
}
function buildSubject(){
  const age=ageText();
  const subject=val('subjectType')||'persona adulta';
  const realism=ageRealismText();
  const anti=val('antiAge')==='on'?'mantener de forma clara la edad seleccionada, no infantilizar ni rejuvenecer en exceso':'';
  const body=val('bodytype');
  const sensual=sensualText();
  const expr=val('expression')||'mirada directa con confianza';
  const etnia=val('etnia')==='Custom'?(val('customEtnia')||''):(val('etnia')||'');
  const tonoPiel=val('tonoPiel')||'';
  const rasgos=val('rasgos')||'';
  return sc(join([subject+' de '+age+', presencia profesional serena',etnia,tonoPiel,rasgos,body,realism,anti,sensual,expr]));
}

/* ── COHERENCE ── */
function coherenceFix(shoes,scene){
  if(val('autoFit')==='off') return shoes;
  const s=scene.toLowerCase();
  if((s.includes('playa')||s.includes('piscina'))&&shoes.includes('zapatillas de casa')) return 'sandalias de playa minimalistas';
  if((s.includes('playa')||s.includes('piscina'))&&shoes.includes('tacones clásicos')) return 'sandalias elegantes de tiras finas';
  if((s.includes('yoga')||s.includes('pilates'))) return 'descalza de forma natural';
  if(s.includes('gimnasio')&&(shoes.includes('tacón')||shoes.includes('boudoir'))) return 'zapatillas deportivas premium blancas';
  if((s.includes('balcón')||s.includes('terraza')||s.includes('jardín'))&&shoes.includes('zapatillas de casa')) return 'sandalias elegantes de tiras finas';
  if(s.includes('hotel')&&shoes.includes('zapatillas de casa')) return 'mules de satén con tacón bajo tipo boudoir';
  return shoes;
}

/* ── VARIATION ── */
function variation(i){
  if(val('variation')==='none') return '';
  const soft=['ligera sonrisa natural','pequeño cambio de postura','mirada relajada a cámara','gesto cotidiano realista'];
  const high=['ángulo de cámara diferente','objeto discreto en el fondo','postura más espontánea','mirada fuera de cámara'];
  return (val('variation')==='high'?high:soft)[i%(val('variation')==='high'?high:soft).length];
}

/* ── FORMAT TAIL ── */
function formatTail(){
  const f=val('format');
  if(f==='chatgpt') return 'photorealistic fashion editorial, natural proportions, sharp detail, high resolution';
  if(f==='midjourney') return '--ar 2:3 --style raw --v 6';
  if(f==='gemini') return 'imagen realista, coherente y limpia';
  if(f==='flux') return 'photorealistic, sharp focus, 8K detail, natural skin texture, coherent anatomy';
  if(f==='leonardo') return 'photorealistic, high detail, natural lighting, consistent anatomy, sharp';
  if(f==='firefly') return 'fotografía realista de alta resolución, proporciones naturales, detalles nítidos';
  return 'proporciones realistas, manos naturales, cuerpo visible completo';
}

/* ── TRANSLATION (ES→EN) ── */
const translations={
  'persona adulta de':'adult person aged','modelo adulta de':'adult female model aged','modelo adulto de':'adult male model aged','persona adulta no binaria de':'adult non-binary person aged','retrato corporativo adulto de':'adult corporate portrait subject aged','artista adulto de':'adult artist aged','modelo senior de':'senior model aged','presencia profesional serena':'serene professional presence',
  'rasgos naturales acordes a la edad seleccionada, piel con textura realista':'natural features consistent with the selected age, realistic skin texture',
  'rasgos senior elegantes, piel realista con textura natural, manos y cuello acordes a la edad':'elegant senior features, realistic natural skin texture, hands and neck consistent with the age','rasgos editoriales realistas, piel natural con textura visible, manos coherentes':'realistic editorial features, natural visible skin texture, coherent hands',
  'mantener de forma clara la edad seleccionada, no infantilizar ni rejuvenecer en exceso':'clearly maintain the selected age, do not infantilize or over-rejuvenate',
  'actitud natural y elegante, presencia cuidada y atractiva':'natural and elegant attitude, refined and attractive presence',
  'actitud editorial segura, presencia elegante y sofisticada, no explícito':'confident editorial attitude, elegant and sophisticated presence, non-explicit',
  'presencia editorial intensa, actitud segura, elegancia adulta no explícita':'intense editorial presence, confident attitude, non-explicit adult elegance',
  'mirada directa con confianza':'direct confident gaze','mirada tranquila y segura':'calm and confident look',
  'ligera sonrisa cálida':'soft warm smile','mirada serena con presencia':'serene gaze with presence',
  'mirada editorial bajo cejas':'editorial gaze under brows','labios entreabiertos, mirada intensa':'parted lips, intense look',
  'de pie de frente, cuerpo entero':'standing facing forward, full body','de pie con postura natural y relajada':'standing naturally and relaxed',
  'sentada en sofá con postura natural':'sitting on sofa naturally','sentada en la cama de forma relajada':'sitting on bed, relaxed',
  'recostada con actitud relajada':'reclining, relaxed attitude','posando de forma limpia estilo catálogo':'clean catalog-style pose',
  'fotografía realista natural':'natural realistic photography','editorial de moda elegante':'elegant fashion editorial',
  'ultra realista 4K':'ultra-realistic 4K','fotografía profesional de revista':'professional magazine photography',
  'luz natural lateral suave':'soft natural side light','luz cálida de tarde':'warm afternoon light',
  'hora dorada suave exterior':'gentle golden hour outdoors','luz de ventana difusa':'diffused window light',
  'luz de hotel cálida y elegante':'warm elegant hotel light','luz de estudio suave y limpia':'soft clean studio light',
  'comedor moderno y luminoso':'modern bright dining room','salón acogedor con sofá':'cozy living room with sofa',
  'dormitorio elegante y ordenado':'elegant tidy bedroom','habitación de hotel boutique':'boutique hotel room',
  'suite de hotel con luz cálida':'hotel suite with warm light','estudio fotográfico con fondo neutro':'photo studio with neutral background',
  'loft urbano con grandes ventanales':'urban loft with large windows','terraza mediterránea':'Mediterranean terrace',
  'balcón con vistas al mar o ciudad':'balcony overlooking sea or city',
  'piscina privada con hamaca y luz de tarde':'private pool with lounger and afternoon light',
  'playa mediterránea con luz cálida de atardecer':'Mediterranean beach with warm sunset light',
  'lleva':'wearing','en':'in','cuerpo entero':'full body',
  'imagen realista':'realistic image','imagen fotográfica realista':'realistic photographic image',
  'proporciones realistas, manos naturales, cuerpo visible completo':'realistic proportions, natural hands, full body visible',
  'estética editorial adulta, imagen editorial no explícita':'adult editorial aesthetics, non-explicit editorial image',
  'fotografía editorial, estética elegante, no explícito':'editorial photography, elegant aesthetics, not explicit',
  'cuerpo entero, de pies a cabeza':'full body, head to toe','plano medio, de cintura para arriba':'medium shot, waist up',
  'plano americano, de rodillas para arriba':'American shot, knees up','primer plano, retrato':'close-up, portrait',
  'plano detalle de piernas y calzado':'detail shot of legs and footwear','plano detalle de ropa y textura':'detail shot of clothing and texture',
  'ángulo frontal directo':'direct frontal angle','ángulo 3/4 ligeramente lateral':'3/4 slightly lateral angle',
  'ángulo lateral de perfil':'profile angle','ángulo desde atrás con giro de cabeza':'from behind with head turn',
  'ángulo ligeramente elevado desde arriba':'slightly elevated angle from above',
  'ángulo ligeramente bajo, desde abajo':'slightly low angle from below',
  'lente 35mm estilo reportaje natural':'35mm lens, natural reportage style',
  'lente 50mm natural equilibrado':'50mm lens, balanced natural',
  'lente 85mm portrait con bokeh suave':'85mm portrait lens with soft bokeh',
  'lente 70–200mm con fondo comprimido':'70–200mm lens with compressed background',
  'sin bokeh, fondo nítido':'no bokeh, sharp background','bokeh fuerte y cremoso':'strong creamy bokeh',
  'moño bajo elegante':'elegant low bun','media melena ondulada natural':'natural wavy mid-length hair',
  'cabello blanco puro elegante':'elegant pure white hair','cabello gris plata elegante':'elegant silver-grey hair',
  'cabello rubio dorado':'golden blonde hair','pelo corto pixie elegante':'elegant pixie short hair',
  'maquillaje natural suave, piel luminosa':'soft natural makeup, luminous skin',
  'maquillaje clásico con labios rojos y piel perfecta':'classic makeup with red lips and perfect skin',
  'labios rojos clásicos':'classic red lips','labios nude natural':'natural nude lips',
  'medias thigh-high':'thigh-high stockings','medias thigh-high con encaje elegante':'thigh-high stockings with elegant lace',
  'pantyhose completas':'full pantyhose','medias opacas 40D':'40D opaque stockings',
  'banda superior ligeramente más oscura':'slightly darker upper band',
  'semitransparentes':'semi-transparent','altura muslo':'thigh height',
  'zapatillas de casa cerradas por delante y abiertas por detrás':'closed-front open-back house slippers',
  'tacón bajo cómodo y elegante':'comfortable elegant low heel',
  'stiletto de tacón fino elegante':'elegant thin-heel stiletto',
  'sandalias elegantes de tiras finas':'elegant thin-strap sandals',
  'collar de perlas clásico':'classic pearl necklace',
  'pendientes de aro dorado fino':'thin gold hoop earrings',
  'persona de origen europeo caucásico':'woman of Caucasian European origin',
  'persona de origen mediterráneo, piel olivácea natural':'woman of Mediterranean origin, naturally olive skin',
  'persona de origen afrocaribeño, piel negra profunda y luminosa':'woman of Afro-Caribbean origin, deep luminous black skin',
  'persona de origen asiático oriental, rasgos coreanos o japoneses':'woman of East Asian origin, Korean or Japanese features',
  'persona de origen indio, piel morena cálida con rasgos sudasiáticos':'woman of Indian origin, warm brown skin with South Asian features',
  'piel muy clara tipo I casi sin melanina':'very fair skin type I',
  'piel beige dorado medio tipo III':'medium golden beige skin type III',
  'piel morena media tipo IV-V':'medium brown skin type IV-V',
  'piel negra profunda tipo VI muy oscuro':'very deep black skin type VI',
  'rasgos delicados y armoniosos':'delicate and harmonious features',
  'rasgos fuertes y definidos con personalidad':'strong and defined features with character',
  'rasgos exóticos con ojos almendrados':'exotic features with almond-shaped eyes',
  'medias thigh-high con patrón de diamantes':'diamond-pattern thigh-high stockings',
  'medias thigh-high con lazo en la banda superior':'thigh-high stockings with bow at top band',
  'medias thigh-high de encaje floral completo':'full floral lace thigh-high stockings',
  'medias de red gruesa tipo cabaret editorial':'thick fishnet stockings cabaret editorial',
  'liguero con medias thigh-high a juego de encaje negro':'suspender belt with matching black lace thigh-highs',
  'fotografía estética cottagecore, pastoral suave y natural':'cottagecore aesthetic photography, soft pastoral natural',
  'fotografía tipo Old Hollywood glamour con luces suaves y encuadre clásico':'Old Hollywood glamour photography with soft lights and classic framing',
  'fotografía tipo Annie Leibovitz, retrato íntimo con narrativa':'Annie Leibovitz style photography, intimate portrait with narrative',
};
function translateES(text){
  let t=text;
  Object.keys(translations).sort((a,b)=>b.length-a.length).forEach(k=>{
    t=t.split(k).join(translations[k]);
  });
  return t;
}

/* ── BUILD PROMPT ── */
function build(i=0,addSafety=true){
  fixLegCoherence();
  const subject=buildSubject();
  const outfit=getOutfit();
  const scene=getCatScene();
  const shoes=coherenceFix(pick('shoes','customShoes')||'calzado elegante',scene);
  const legs=legwear();
  const jewelry=val('jewelry')==='Custom'?(val('customJewelry')||''):(val('jewelry')||'');
  const acc=val('accessories')==='Custom'?(val('customAccessories')||''):(val('accessories')||'');
  const catAcc=getCatAcc();
  const hair=getHair();
  const makeup=getMakeup();
  const style=pick('style','customStyle')||'fotografía realista natural';
  const action=pick('action','customAction')||'de pie con postura natural';
  const lighting=val('lighting')||'luz natural lateral suave';
  const safe=addSafety?safetyText():'';
  const cam=`${camState.plano}, ${camState.angulo}, ${camState.lente}`;
  const mode=val('mode');
  const detail=val('detail');

  const footFix=footProtection();
  const wearParts=[outfit];
  if(legs) wearParts.push(legs);
  wearParts.push(shoes);
  if(footFix) wearParts.push(footFix);
  if(jewelry) wearParts.push(jewelry);
  if(acc) wearParts.push(acc);
  if(catAcc) wearParts.push(catAcc);
  const wearing=join(wearParts);
  const hairMakeupLine=join([hair,makeup]);

  let raw='';
  if(mode==='raw'){
    raw=sc(`${subject}, lleva ${wearing}${hairMakeupLine?', '+hairMakeupLine:''}. ${action} en ${scene}. ${style}, ${lighting}. ${cam}. imagen realista.${safe?' '+safe+'.':''}`);
  } else if(mode==='raw_advanced'){
    const a=sc(`${subject}, lleva ${wearing}${hairMakeupLine?', '+hairMakeupLine:''}. ${action} en ${scene}. ${style}, ${lighting}. ${cam}. imagen realista.${safe?' '+safe+'.':''}`);
    const altScene=scene.includes('comedor')?'terraza moderna y luminosa':'comedor moderno y luminoso';
    const b=sc(`${subject}, lleva ${wearing}${hairMakeupLine?', '+hairMakeupLine:''}. postura diferente y natural en ${altScene}. ${style}, luz cálida de tarde. ${cam}. imagen realista.${safe?' '+safe+'.':''}`);
    raw=a+'\n\n'+b;
  } else if(mode==='raw_cinematic'){
    const lights=['luz natural suave de mañana','luz cálida de tarde lateral','hora dorada con sombras largas'];
    const cams=[`${camState.plano}, ${camState.angulo}, lente 35mm`,`${camState.plano}, ángulo 3/4 ligeramente lateral, ${camState.lente}`,`${camState.plano}, ${camState.angulo}, lente 85mm portrait con bokeh suave`];
    raw=[0,1,2].map(n=>sc(`${subject}, lleva ${wearing}${hairMakeupLine?', '+hairMakeupLine:''}. ${action} en ${scene}. ${style}, ${lights[n]}. ${cams[n]}. imagen realista.${safe?' '+safe+'.':''}`)).join('\n\n');
  } else {
    const base=sc(`${subject}${hairMakeupLine?', '+hairMakeupLine:''}, lleva ${wearing}. ${action} en ${scene}. ${style}`);
    const varText=variation(i);
    if(detail==='ultra') raw=`${subject}, ${wearing}, ${action}, en ${scene}, ${style}.`;
    else if(detail==='simple') raw=sc(`${base}, ${lighting}. ${cam}. imagen realista.${safe?' '+safe+'.':''}`);
    else if(detail==='mejorado') raw=sc(`${base}, ${lighting}. ${cam}. ${formatTail()}.${safe?' '+safe+'.':''}${varText?' '+varText+'.':''}`);
    else raw=sc(`${base}, ${lighting}, textura realista en piel y tejidos, postura relajada, manos naturales. ${cam}. ${formatTail()}.${safe?' '+safe+'.':''}${varText?' '+varText+'.':''}`);
  }
  return outputLang==='en'?translateES(raw):raw;
}

/* ── GENERATE ── */
/* ══════════════════════════════════════════════
   ANTI-FILTER SYSTEM — DALL·E / ChatGPT Imagen
   ══════════════════════════════════════════════ */

// Terms that trigger DALL·E content filter, mapped to fashion equivalents
const DALLE_REMAP = [
  // Editoriality / attitude
  [/presencia editorial intensa, actitud segura, elegancia adulta no explícita/g,
   'confident editorial presence, elegant and composed, sophisticated adult appeal'],
  [/actitud editorial segura, presencia elegante y sofisticada, no explícito/g,
   'assured and graceful editorial presence, refined adult elegance'],
  [/presencia editorial adulta/gi, 'sophisticated elegance'],
  [/seductora/gi, 'confident and assured'],
  [/editorial/gi, 'editorial'],
  [/provocadora/gi, 'striking'],
  [/erótic[ao]/gi, 'editorial'],

  // Lencería vocabulary
  [/lencería|intimates editorial|layering editorial/gi, 'luxury fashion layering'],
  [/bodysuit de encaje/gi, 'lace bodysuit fashion editorial'],
  [/bodysuit de satén/gi, 'satin bodysuit editorial'],
  [/bodysuit floral de encaje semitransparente/gi, 'sheer floral lace bodysuit editorial'],
  [/bodysuit de rejilla/gi, 'mesh bodysuit fashion'],
  [/corset de satén/gi, 'satin corset fashion editorial'],
  [/bustier de encaje/gi, 'lace bustier fashion'],
  [/corset de terciopelo/gi, 'velvet corset editorial fashion'],
  [/babydoll/gi, 'babydoll lingerie fashion editorial'],
  [/liguero/gi, 'garter belt fashion editorial'],
  [/conjunto de lencería/gi, 'lingerie set fashion editorial'],
  [/combinación de seda/gi, 'silk slip dress editorial'],
  [/camisón tipo slip/gi, 'silk slip dress fashion'],
  [/bralette/gi, 'bralette fashion editorial'],

  // Medias vocabulary  
  [/medias thigh-high con costura trasera/gi, 'thigh-high stockings with back seam, fashion editorial'],
  [/medias thigh-high con encaje/gi, 'lace-top thigh-high stockings, fashion editorial'],
  [/medias thigh-high/gi, 'thigh-high stockings fashion editorial'],
  [/medias de rejilla fina editorial/gi, 'fine fishnet stockings fashion editorial'],
  [/medias de red gruesa/gi, 'fishnet stockings cabaret fashion'],
  [/medias con banda superior de encaje visible/gi, 'lace-top stockings fashion'],
  [/medias altas con banda de silicona/gi, 'hold-up stockings fashion editorial'],
  [/pantyhose/gi, 'sheer hosiery fashion'],

  // Poses
  [/inclinada hacia cámara, escote hacia adelante/gi,
   'leaning toward camera, elegant neckline forward'],
  [/tumbada boca abajo con pies elevados/gi,
   'lying face down with feet elevated, relaxed editorial pose'],
  [/pose felina/gi, 'elegant floor pose'],
  [/labios entreabiertos, mirada intensa/gi, 'parted lips, intense gaze, editorial'],
  [/expresión editorial contenida/gi, 'composed editorial expression'],
  [/mirada editorial bajo cejas/gi, 'editorial gaze under brows'],

  // Safety text adjustment for DALL·E
  [/estética editorial adulta, imagen editorial no explícita/gi,
   'fashion editorial photography, tasteful and elegant, non-explicit'],
  [/fotografía editorial, estética elegante, no explícito/gi,
   'high-fashion editorial photography, elegant and tasteful'],
];

// Apply DALL·E-safe remapping to a prompt string
function dalleRemap(prompt) {
  let p = prompt;
  DALLE_REMAP.forEach(([from, to]) => { p = p.replace(from, to); });
  // Force English for DALL·E (it handles EN better)
  return p;
}

// Analyze current config and return risk level + reasons
function analyzeFilterRisk() {
  const format = val('format');
  if (format !== 'chatgpt') return null; // only relevant for DALL·E

  const sensual = val('sensual');
  const cat = typeof activeCat !== 'undefined' ? activeCat : '';
  const safe = val('safe');
  const legtype = val('legtype') || '';
  const action = (val('action') || '').toLowerCase();
  const outfit = (val('outfit-' + cat) || '').toLowerCase();

  const risks = [];

  if (sensual === 'high') risks.push({ lvl: 2, msg: 'Intensidad editorial alta → puede activar filtros de imagen' });
  else if (sensual === 'medium') risks.push({ lvl: 1, msg: 'Intensidad editorial media → revisar styling y lenguaje' });

  if (cat === 'lenceria') risks.push({ lvl: 1, msg: 'Categoría Layering/Intimates → revisar vocabulario si se usa DALL·E' });

  if (legtype.includes('rejilla') || legtype.includes('red')) risks.push({ lvl: 1, msg: 'Medias de rejilla/red → marcador frecuente en DALL·E' });
  if (legtype.includes('thigh-high') && sensual !== 'off') risks.push({ lvl: 1, msg: 'Thigh-high + intensidad editorial → combinación de riesgo medio' });
  if (legtype.includes('costura trasera') || legtype.includes('banda de silicona')) risks.push({ lvl: 1, msg: 'Medias con costura/silicona → vocabulario específico puede activar filtro' });

  if (action.includes('inclinada hacia cámara') || action.includes('labios entreabiertos')) risks.push({ lvl: 1, msg: 'Pose o expresión detectada como editorial por DALL·E' });
  if (action.includes('boca abajo') || action.includes('felina')) risks.push({ lvl: 1, msg: 'Pose de suelo → riesgo moderado si hay styling íntimo activo' });

  if (safe === 'off' && risks.length > 0) risks.push({ lvl: 1, msg: 'Sin cláusula de seguridad → añadir "Suave" o "Estricto" reduce rechazos' });

  const maxLvl = risks.length === 0 ? 0 : Math.max(...risks.map(r => r.lvl));
  return { maxLvl, risks };
}

function checkFilterRisk() {
  const box = el('filterRiskBox');
  if (!box) return;
  const result = analyzeFilterRisk();
  if (!result) {
    box.className = 'filter-risk';
    box.innerHTML = '';
    return;
  }
  const { maxLvl, risks } = result;
  if (maxLvl === 0) {
    box.className = 'filter-risk risk-ok visible';
    box.innerHTML = '<span class="filter-mode-badge">DALL·E</span>✓ Configuración compatible — bajo riesgo de rechazo';
    return;
  }
  const cls = maxLvl >= 2 ? 'risk-high' : 'risk-warn';
  const icon = maxLvl >= 2 ? '⚠ Alto riesgo de rechazo' : '◆ Riesgo moderado';
  const remapNote = '<div data-u-style="u056">→ <b>Anti-filtro activo</b>: el prompt se reescribe automáticamente con vocabulario fashion antes de generar</div>';
  box.className = `filter-risk ${cls} visible`;
  box.innerHTML = `<span class="filter-mode-badge">DALL·E</span>${icon}
<div class="risk-items">${risks.map(r => `· ${r.msg}`).join('<br>')}</div>${remapNote}`;
}


function generate(){
  if(!validateAdultOnly()) return;
  let prompt=build(0,true);
  if(val('format')==='chatgpt') prompt=dalleRemap(prompt);
  el('output').value=prompt;
  updateTokenCounter(prompt);
  addToHistory(prompt);
  checkFilterRisk();
}

/* ── TOKEN COUNTER ── */
function updateTokenCounter(text){
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  const tokens=Math.round(words*1.35);
  const max=4000;
  const pct=Math.min(100,Math.round(tokens/max*100));
  const tc=el('tokenCount');const tf=el('tokenFill');const tp=el('tokenPct');
  if(tc)tc.textContent=tokens;
  if(tf)tf.style.width=pct+'%';
  if(tp)tp.textContent=pct+'%';
  if(tf){
    if(pct>80)tf.style.background='var(--rose)';
    else if(pct>50)tf.style.background='var(--gold)';
    else tf.style.background='var(--grad)';
  }
}

/* ── LIVE TOGGLE ── */
function toggleLive(){
  liveEnabled=!liveEnabled;
  const badge=el('liveBadge');const dot=el('liveDot');
  if(badge){badge.classList.toggle('off',!liveEnabled);}
  if(dot){dot.classList.toggle('off',!liveEnabled);}
}
function scheduleLive(){
  if(!liveEnabled)return;
  clearTimeout(liveTimer);
  liveTimer=setTimeout(generate,350);
}
function generateBatch(){
  if(!validateAdultOnly()) return;
  const n=Math.min(50,Math.max(1,parseInt(val('amount'),10)||10));
  const isDalle=val('format')==='chatgpt';
  const out=[];
  for(let i=0;i<n;i++){
    let p=build(i,i===0);
    if(isDalle) p=dalleRemap(p);
    out.push(`${i+1}. ${p}`);
  }
  const batch=out.join('\n\n');
  el('output').value=batch;
  addToHistory(batch.split('\n')[0].replace(/^1\.\s*/,'').substring(0,120)+'…');
  updateTokenCounter(batch);
  checkFilterRisk();
}

/* ── TRANSLATE BUTTON ── */
function translateOutput(){
  const current=el('output').value;
  if(!current) return;
  let translated=translateES(current);
  if(val('format')==='chatgpt') translated=dalleRemap(translated);
  el('output').value=translated;
  checkFilterRisk();
}

/* ── HISTORY ── */
function addToHistory(text){
  let hist=JSON.parse(localStorage.getItem('psos14History')||'[]');
  const entry={text:text.substring(0,300),date:new Date().toISOString(),lang:outputLang,cat:activeCat};
  hist=hist.filter(h=>h.text!==entry.text);
  hist.unshift(entry);
  localStorage.setItem('psos14History',JSON.stringify(hist.slice(0,20)));
  renderHistory();
}
function renderHistory(){
  const hist=safeJSON('psos14History',[]);
  const t=el('histList');
  if(!t)return;
  if(!hist.length){t.innerHTML="<span data-u-style=\"u069\">Sin historial aún.</span>";return}
  t.innerHTML=hist.map((h,i)=>`
    <div class="hist-item" data-onclick="loadHistory(${i})">
      <div class="hist-meta">${escapeHTML(safeDate(h.date).toLocaleString())} · ${escapeHTML(h.cat||'')} · ${escapeHTML(h.lang||'es')}</div>
      ${escapeHTML(String(h.text||'').substring(0,200))}${String(h.text||'').length>200?'…':''}
      <button class="hist-del" data-onclick="event.stopPropagation();deleteHistory(${i})">✕</button>
    </div>`).join('');
}
function loadHistory(i){
  const hist=JSON.parse(localStorage.getItem('psos14History')||'[]');
  if(hist[i]) el('output').value=hist[i].text;
}
function deleteHistory(i){
  const hist=JSON.parse(localStorage.getItem('psos14History')||'[]');
  hist.splice(i,1);
  localStorage.setItem('psos14History',JSON.stringify(hist));
  renderHistory();
}
function clearHistory(){
  if(confirm('¿Borrar todo el historial?')){localStorage.removeItem('psos14History');renderHistory();}
}

function updateSensualUI(){return updateEditorialUI();}

/* ── COPY / DOWNLOAD ── */
async function copyOutput(){
  try{
    await navigator.clipboard.writeText(el('output').value);
    const f=el('copyFlash');f.classList.add('show');
    setTimeout(()=>f.classList.remove('show'),1800);
  }catch(e){alert('Selecciona y copia manualmente')}
}
function downloadTxt(){
  const blob=new Blob([el('output').value],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='photo_studio_os_v1_4_prompts.txt';
  a.click();URL.revokeObjectURL(a.href);
}

/* ── RANDOM ── */
function randomFrom(id){
  const n=el(id);if(!n)return;
  const items=Array.from(n.options).map(o=>o.value).filter(x=>x&&x!=='Custom'&&!x.startsWith('──'));
  if(items.length) n.value=items[Math.floor(Math.random()*items.length)];
}
function randomPills(containerId,field,options){
  const idx=Math.floor(Math.random()*options.length);
  camState[field]=options[idx].value;
  el(containerId).querySelectorAll('.cam-pill').forEach((b,i)=>b.classList.toggle('active',i===idx));
}
function randomCoherent(){
  const cats=['cotidiana','gala','lenceria','disfraz','banyo','deporte'];
  const ci=Math.floor(Math.random()*cats.length);
  switchCat(cats[ci],document.querySelectorAll('.cat-tab')[ci]);
  ['age','ageRealism','bodytype','expression','shoes','style','legtype','legcolor','transparency','texture','sensual','lighting','action','scene','hairStyle','hairColor','hairFinish','makeupLook','lipColor','eyeMakeup','outfitColor','outfitPattern','etnia','tonoPiel','rasgos'].forEach(randomFrom);
  if(val('legtype')==='sin medias visibles') setVal('legmode','off'); else setVal('legmode','on');
  fixLegCoherence();updateEditorialUI();updateHairSwatch();updateLipSwatch();updateOutfitSwatch();updateLegSwatch();
  const planoOpts=[{value:'cuerpo entero, de pies a cabeza'},{value:'plano medio, de cintura para arriba'},{value:'plano americano, de rodillas para arriba'}];
  const anguloOpts=[{value:'ángulo frontal directo'},{value:'ángulo 3/4 ligeramente lateral'},{value:'ángulo lateral de perfil'}];
  const lenteOpts=[{value:'lente 35mm estilo reportaje natural'},{value:'lente 50mm natural equilibrado'},{value:'lente 85mm portrait con bokeh suave'}];
  randomPills('planoPills','plano',planoOpts);
  randomPills('anguloPills','angulo',anguloOpts);
  randomPills('lentePills','lente',lenteOpts);
  generate();
}
function autoPerfect(){
  setVal('mode','clean');setVal('detail','mejorado');
  setVal('safe',val('format')==='chatgpt'?'strict':'soft');
  setVal('variation','soft');
  if(subjectContext()==='female'){
    setVal('legmode','on');setVal('legtype','medias thigh-high');
    setVal('legcolor',(activeCat==='lenceria'||activeCat==='gala')?'negras':'marrones');
    setVal('height','altura muslo');
  }else{
    setVal('legmode','off');setVal('legtype','sin medias visibles');setVal('legcolor','sin color específico');
  }
  setVal('transparency','semitransparentes');
  setVal('sensual',val('format')==='chatgpt'?'soft':'medium');
  setVal('lighting','luz natural lateral suave');setVal('style','fotografía realista natural');
  fixLegCoherence();updateEditorialUI();updateLegSwatch();checkFilterRisk();
  generate();
}

/* ── SAVE/LOAD PRESETS ── */
function captureState(){
  const ids=['age','subjectType','ageRealism','bodytype','antiAge','sensual','expression','etnia','customEtnia','tonoPiel','rasgos','lighting',
    'outfit-cotidiana','customOutfit-cotidiana','outfitDetail',
    'outfit-gala','customOutfit-gala','galaDetail',
    'outfit-lenceria','customOutfit-lenceria','lenceriaLayer',
    'outfit-disfraz','customOutfit-disfraz','disfrazFit','disfrazProp',
    'outfit-banyo','customOutfit-banyo','banyoScene','banyoAcc',
    'outfit-deporte','customOutfit-deporte','deporteScene','deporteAcc',
    'outfitColor','outfitColor2','outfitPattern','outfitFabric',
    'hairStyle','hairColor','hairFinish','hairAcc',
    'makeupLook','lipColor','eyeMakeup','skinLook',
    'shoes','customShoes','jewelry','customJewelry','accessories','customAccessories',
    'legtype','legcolor','transparency','texture','height','legmode','customLegwear',
    'scene','customScene','action','customAction','style','customStyle',
    'mode','detail','format','safe','variation','amount'];
  const o={cat:activeCat,cam:{...camState},lang:outputLang};
  ids.forEach(id=>o[id]=val(id));
  return o;
}
function applyState(o){
  if(!o) return;
  if(o.cat){const idx=['cotidiana','gala','lenceria','disfraz','banyo','deporte'].indexOf(o.cat);
    if(idx>=0) switchCat(o.cat,document.querySelectorAll('.cat-tab')[idx]);}
  if(o.cam) camState={...o.cam};
  if(o.lang) setLang(o.lang);
  Object.keys(o).forEach(id=>{if(id!=='cat'&&id!=='cam'&&id!=='lang') setVal(id,o[id])});
  applySubjectContext({preserveValues:true});
  updateEditorialUI();updateSkinSwatch();updateHairSwatch();updateLipSwatch();updateOutfitSwatch();updateOutfitSwatch2();updateLegSwatch();
  generate();
}


function loadPreset(i){const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');if(!list[i])return;list[i].useCount=(list[i].useCount||0)+1;localStorage.setItem('psos14Presets',JSON.stringify(list));applyState(list[i].state);}
function toggleFavorite(i){const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');if(!list[i])return;list[i].fav=!list[i].fav;localStorage.setItem('psos14Presets',JSON.stringify(list));renderPresets();}
function deletePreset(i){const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');list.splice(i,1);localStorage.setItem('psos14Presets',JSON.stringify(list));renderPresets()}

/* ── CLONE PRESET ── */
function clonePreset(i){
  const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  if(!list[i]) return;
  const clone=JSON.parse(JSON.stringify(list[i]));
  clone.name='[Clone] '+clone.name;
  clone.date=new Date().toISOString();
  list.splice(i+1,0,clone);
  localStorage.setItem('psos14Presets',JSON.stringify(list.slice(0,80)));
  renderPresets();
  // flash the preset name input with the clone name so user can rename easily
  const inp=el('presetName');
  if(inp){inp.value=clone.name;inp.focus();}
}

/* ── TAG FILTER ── */
function setTagFilter(tag,btn){
  window._activeTagFilter=tag;
  document.querySelectorAll('.tag-filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderPresets();
}

/* ── A/B COMPARATOR ── */
function openAB(){el('abOverlay').classList.add('open')}
function closeAB(){el('abOverlay').classList.remove('open')}
function generateAB(v){
  // Temporarily override key params to generate an AB variant
  const sensualSel=el('abSensual'+v);
  const safeSel=el('abSafe'+v);
  const styleSel=el('abStyle'+v);
  const origEditorial=val('sensual');
  const origSafe=val('safe');
  const origStyle=val('style');
  setVal('sensual',sensualSel?sensualSel.value:origEditorial);
  setVal('safe',safeSel?safeSel.value:origSafe);
  setVal('style',styleSel?styleSel.value:origStyle);
  const prompt=build(0,true);
  el('abOutput'+v).value=outputLang==='en'?translateES(prompt):prompt;
  // restore
  setVal('sensual',origEditorial);setVal('safe',origSafe);setVal('style',origStyle);
}
async function copyAB(v){
  const ta=el('abOutput'+v);
  if(!ta||!ta.value) return;
  try{await navigator.clipboard.writeText(ta.value);alert('Variante '+v+' copiada ✓');}
  catch(e){ta.select();}
}
function useAB(v){
  // Apply AB variant settings to the main UI and close
  const sensualSel=el('abSensual'+v);
  const safeSel=el('abSafe'+v);
  const styleSel=el('abStyle'+v);
  if(sensualSel) setVal('sensual',sensualSel.value);
  if(safeSel) setVal('safe',safeSel.value);
  if(styleSel) setVal('style',styleSel.value);
  updateEditorialUI();generate();closeAB();
}

/* ── SEQUENCE MODE ── */
const SEQ_PARAMS={
  age:{label:'Edad',values:['18 años','21 años','25 años','30 años','35 años','40 años','50 años','60 años','70 años','80 años'],field:'age'},
  sensual:{label:'Editorial',values:['off','soft','medium','high'],field:'sensual'},
  legtype:{label:'Tipo medias',values:['medias thigh-high','medias thigh-high con encaje elegante','medias opacas 40D','medias negras translúcidas efecto piel','pantyhose completas','medias thigh-high con costura trasera','medias de rejilla fina editorial'],field:'legtype'},
  outfitColor:{label:'Color ropa',values:['negro','rojo','blanco','burdeos','champagne','lila','verde esmeralda','coral','dorado','azul marino'],field:'outfitColor'},
  lighting:{label:'Luz',values:['luz natural lateral suave','luz cálida de tarde','hora dorada suave exterior','luz de hotel cálida y elegante','luz de estudio suave y limpia','luz mediterránea natural','contraluz suave difuminado','luz dramática lateral tipo Rembrandt'],field:'lighting'},
  hairColor:{label:'Cabello',values:['cabello blanco puro elegante','cabello gris plata elegante','cabello negro natural','cabello rubio dorado','cabello castaño oscuro natural','cabello rojizo cobrizo natural','cabello blanco plateado con brillo'],field:'hairColor'},
  scene:{label:'Escena',values:['comedor moderno y luminoso','dormitorio elegante y ordenado','suite de hotel con luz cálida','vestidor moderno con espejo grande','balcón con vistas al mar o ciudad','sala de lectura con sillón','loft urbano con grandes ventanales','jardín privado con luz de tarde'],field:'scene'},
  expression:{label:'Expresión',values:['mirada directa con confianza','mirada tranquila y segura','ligera sonrisa cálida','mirada editorial bajo cejas','sonrisa suave y elegante','expresión editorial contenida'],field:'expression'},
  shoes:{label:'Calzado',values:['stiletto de tacón fino elegante','tacón bajo cómodo y elegante','kitten heel elegante 3–4cm','mules de satén con tacón bajo tipo boudoir','sandalias elegantes de tiras finas','botines de cuero con tacón bajo','descalza de forma natural'],field:'shoes'},
  style:{label:'Estilo visual',values:['fotografía realista natural','editorial de moda elegante','ultra realista 4K','fotografía profesional de revista','lifestyle doméstico realista','cinematográfico suave'],field:'style'}
};
function openSeq(){el('seqOverlay').classList.add('open')}
function closeSeq(){el('seqOverlay').classList.remove('open')}
function runSequence(){
  const paramKey=val('seqParam');
  const count=parseInt(val('seqCount'),10)||5;
  const paramDef=SEQ_PARAMS[paramKey];
  if(!paramDef){el('seqResult').textContent='Parámetro no reconocido.';el('seqResult').style.display='block';return;}
  const values=paramDef.values.slice(0,count);
  const origVal=val(paramDef.field);
  const lines=[];
  values.forEach((v,i)=>{
    setVal(paramDef.field,v);
    if(paramDef.field==='sensual') updateEditorialUI();
    if(paramDef.field==='legtype') fixLegCoherence();
    const prompt=build(0,false);
    lines.push(`── ${i+1}/${values.length} · ${paramDef.label}: ${v} ──\n${outputLang==='en'?translateES(prompt):prompt}`);
  });
  setVal(paramDef.field,origVal);
  if(paramDef.field==='sensual') updateEditorialUI();
  const out=lines.join('\n\n');
  const r=el('seqResult');
  r.textContent=out;r.style.display='block';
}
async function copySeqOutput(){
  const r=el('seqResult');
  if(!r||!r.textContent) return;
  try{await navigator.clipboard.writeText(r.textContent);alert('Secuencia copiada ✓');}
  catch(e){r.select&&r.select();}
}
function clearPresets(){if(confirm('¿Borrar todos los presets guardados?')){localStorage.removeItem('psos14Presets');renderPresets()}}

/* ── EXPORT / IMPORT JSON ── */
function exportPresetsJSON(){
  const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  if(!list.length){alert('No hay presets guardados para exportar.');return;}
  const blob=new Blob([JSON.stringify(list,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='photo_studio_os_v14_presets.json';a.click();URL.revokeObjectURL(a.href);
}
function importPresetsJSON(input){
  const file=input.files[0];if(!file)return;
  if(file.size>2*1024*1024){alert('Archivo demasiado grande. Máximo 2 MB para proteger el navegador.');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!Array.isArray(data))throw new Error('Formato inválido');
      const existing=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
      const merged=[...data,...existing].slice(0,80);
      localStorage.setItem('psos14Presets',JSON.stringify(merged));
      renderPresets();
      alert('Importados '+data.length+' presets correctamente.');
    }catch(err){alert('Error al importar: '+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}

/* ── BUILT-IN STARTER PRESETS ── */
const STARTER_PRESETS=[
  {
    "name": "Portrait · Retrato ejecutivo · blazer azul",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "40 años",
      "subjectType": "retrato corporativo adulto",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de estudio suave y limpia",
      "outfitColor": "azul marino",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "zapatos negros cerrados elegantes",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "retrato corporativo premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "estudio fotográfico con fondo neutro",
      "outfit-cotidiana": "traje sastre elegante"
    }
  },
  {
    "name": "Fashion · Street editorial · gabardina beige",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "28 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "hora dorada suave exterior",
      "outfitColor": "beige",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "de algodón técnico premium",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "botines de cuero con tacón bajo",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "editorial de moda elegante",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "calle urbana elegante con escaparates",
      "outfit-gala": "trench coat largo editorial"
    }
  },
  {
    "name": "Beauty · Primer plano · piel natural",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "primer plano, retrato",
        "angulo": "ángulo frontal directo",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "30 años",
      "subjectType": "persona adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz natural lateral suave",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje minimal, base uniforme y labios nude",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "piel natural sin base, textura real visible",
      "shoes": "",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "beauty editorial limpio",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "estudio fotográfico con fondo neutro"
    }
  },
  {
    "name": "Lifestyle · Cafetería luminosa · look casual",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "35 años",
      "subjectType": "persona adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de ventana difusa",
      "outfitColor": "blanco",
      "outfitColor2": "con detalles beige",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "mocasines elegantes",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "lifestyle realista premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "cafetería moderna con luz de ventana",
      "outfit-cotidiana": "camisa blanca oversize y pantalón recto"
    }
  },
  {
    "name": "Commercial · Producto skincare · baño premium",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "32 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz suave de estudio comercial",
      "outfitColor": "blanco",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "",
      "jewelry": "",
      "accessories": "frasco de cosmética minimalista en mano",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "fotografía comercial de skincare",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "baño minimalista premium con mármol claro",
      "outfit-cotidiana": "albornoz blanco premium"
    }
  },
  {
    "name": "Editorial · Traje negro · fondo gris",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "38 años",
      "subjectType": "modelo adulto",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz dramática lateral tipo Rembrandt",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "zapatos negros cerrados elegantes",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "editorial masculino de revista",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "estudio fotográfico con fondo gris neutro",
      "outfit-gala": "traje negro de corte moderno"
    }
  },
  {
    "name": "Senior Photography · Retrato premium 65+",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "65 años",
      "subjectType": "modelo senior",
      "ageRealism": "premium",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz cálida de tarde",
      "outfitColor": "beige",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "cabello gris plata elegante",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "zapatos cómodos elegantes",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "senior photography editorial premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "sala de lectura con sillón",
      "outfit-cotidiana": "americana de lino clara y pantalón elegante"
    }
  },
  {
    "name": "Cinematic · Neón urbano · chaqueta cuero",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "29 años",
      "subjectType": "persona adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de neón cinematográfica",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "botines de cuero con tacón bajo",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "cinematográfico urbano",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "calle nocturna con neón y lluvia suave",
      "outfit-cotidiana": "chaqueta de cuero negra y camiseta minimalista"
    }
  },
  {
    "name": "Sportswear · Gimnasio premium",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "30 años",
      "subjectType": "modelo adulto",
      "ageRealism": "soft",
      "bodytype": "figura atlética natural",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz natural lateral suave",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "zapatillas deportivas premium blancas",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "lifestyle deportivo premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "deporte",
      "scene": "gimnasio privado de lujo con espejos",
      "outfit-deporte": "conjunto deportivo técnico premium",
      "deporteScene": "gimnasio privado de lujo con espejos",
      "deporteAcc": "con botella de agua elegante"
    }
  },
  {
    "name": "Swimwear · Resort mediterráneo",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "34 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "hora dorada suave exterior",
      "outfitColor": "azul marino",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "sandalias elegantes de tiras finas",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "campaña resort mediterránea",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "banyo",
      "scene": "piscina de hotel de lujo con vistas al mar",
      "outfit-banyo": "bañador entero elegante de corte clásico",
      "banyoScene": "piscina de hotel de lujo con vistas al mar",
      "banyoAcc": "con gafas de sol de diseño"
    }
  },
  {
    "name": "Vintage · Cine 70s · vestido mostaza",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "33 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz cálida de tarde",
      "outfitColor": "mostaza",
      "outfitColor2": "",
      "outfitPattern": "con estampado geométrico discreto",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "kitten heel elegante 3–4cm",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "fotografía estética cinematográfica años 70",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "salón vintage con lámparas cálidas",
      "outfit-gala": "vestido midi elegante de inspiración setentera"
    }
  },
  {
    "name": "Artistic · Fondo abstracto · alta moda",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "27 años",
      "subjectType": "persona adulta no binaria",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de estudio suave y limpia",
      "outfitColor": "blanco",
      "outfitColor2": "con detalles negros",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "botas minimalistas de diseño",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "editorial artístico contemporáneo",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "estudio artístico con fondo abstracto texturizado",
      "outfit-gala": "pieza de alta moda estructural"
    }
  },
  {
    "name": "Corporate · Equipo creativo · retrato natural",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "42 años",
      "subjectType": "artista adulto",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz natural lateral suave",
      "outfitColor": "gris oscuro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "mocasines elegantes",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "retrato profesional creativo",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "loft urbano con grandes ventanales",
      "outfit-cotidiana": "jersey fino y pantalón sastre"
    }
  },
  {
    "name": "Evening · Gala roja · hotel boutique",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "45 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de hotel cálida y elegante",
      "outfitColor": "rojo vino",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "stiletto de tacón fino elegante",
      "jewelry": "pendientes de gota con piedra",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "editorial de moda elegante",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "suite de hotel con luz cálida",
      "outfit-gala": "vestido de noche largo con escote elegante"
    }
  },
  {
    "name": "Minimal · Fondo blanco · total look negro",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "31 años",
      "subjectType": "modelo adulto",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de estudio suave y limpia",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "zapatillas blancas minimalistas",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "lookbook minimalista comercial",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "estudio fotográfico con fondo blanco limpio",
      "outfit-cotidiana": "camiseta negra premium y pantalón negro recto"
    }
  },
  {
    "name": "Travel · Terraza mediterránea",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "36 años",
      "subjectType": "persona adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz mediterránea natural",
      "outfitColor": "blanco",
      "outfitColor2": "",
      "outfitPattern": "con estampado floral suave",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "sandalias planas de cuero trenzado",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "lifestyle de viaje premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "terraza mediterránea",
      "outfit-cotidiana": "vestido camisero de lino"
    }
  },
  {
    "name": "Music Artist · Portada de disco",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "28 años",
      "subjectType": "artista adulto",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz dramática lateral tipo Rembrandt",
      "outfitColor": "negro",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "",
      "jewelry": "",
      "accessories": "micrófono vintage cercano",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "portada musical editorial",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "estudio musical con luces tenues",
      "outfit-cotidiana": "chaqueta oversize de diseño y pantalón oscuro"
    }
  },
  {
    "name": "Luxury · Joyas · primer plano editorial",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "primer plano, retrato",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "39 años",
      "subjectType": "modelo adulta",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de estudio suave y limpia",
      "outfitColor": "champagne",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "",
      "jewelry": "collar de perlas clásico",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "campaña de joyería luxury",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "estudio fotográfico con fondo neutro",
      "outfit-gala": "top de seda elegante"
    }
  },
  {
    "name": "Senior Lifestyle · Jardín privado 75+",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "75 años",
      "subjectType": "modelo senior",
      "ageRealism": "real",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz cálida de tarde",
      "outfitColor": "beige",
      "outfitColor2": "",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "cabello blanco plateado con brillo",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje natural suave, piel luminosa",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "sandalias elegantes de tiras finas",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "senior lifestyle natural premium",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "cotidiana",
      "scene": "jardín privado con luz de tarde",
      "outfit-cotidiana": "camisa de lino suave y pantalón claro"
    }
  },
  {
    "name": "Avant-garde · Belleza editorial color",
    "date": "2026-06-21T00:00:00.000Z",
    "state": {
      "cam": {
        "plano": "cuerpo entero, de pies a cabeza",
        "angulo": "ángulo 3/4 ligeramente lateral",
        "lente": "lente 85mm portrait con bokeh suave"
      },
      "lang": "es",
      "age": "26 años",
      "subjectType": "persona adulta no binaria",
      "ageRealism": "soft",
      "bodytype": "",
      "antiAge": "on",
      "sensual": "soft",
      "expression": "mirada directa con confianza",
      "lighting": "luz de estudio cromática",
      "outfitColor": "morado",
      "outfitColor2": "con detalles dorados",
      "outfitPattern": "",
      "outfitFabric": "",
      "hairStyle": "",
      "hairColor": "",
      "hairFinish": "",
      "hairAcc": "",
      "makeupLook": "maquillaje editorial de moda, ojos marcados",
      "lipColor": "",
      "eyeMakeup": "",
      "skinLook": "",
      "shoes": "",
      "jewelry": "",
      "accessories": "",
      "legtype": "sin medias visibles",
      "legmode": "off",
      "style": "beauty editorial experimental",
      "mode": "clean",
      "detail": "mejorado",
      "format": "chatgpt",
      "safe": "strict",
      "variation": "soft",
      "amount": "8",
      "cat": "gala",
      "scene": "estudio fotográfico con fondo de color intenso",
      "outfit-gala": "look editorial avant-garde con volumen"
    }
  }
];

function loadStarterPresets(){
  const existing=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  if(existing.length>0) return; // only load if user has no presets yet
  localStorage.setItem('psos14Presets',JSON.stringify(STARTER_PRESETS));
  renderPresets();
}

/* ══════════════════════════════════════════════════
   PHOTO STUDIO OS v1.4 — LEGWEAR + SHARE
══════════════════════════════════════════════════ */

/* ── FIX: DALL·E n>1 (parallel calls, DALL·E 3 only supports n=1) ── */
async function generateDalle(){
  if(!validateAdultOnly()) return;
  const keys=getKeys();
  if(!keys.openai){alert('Añade tu API key de OpenAI en el panel de keys.');return;}
  let prompt=el('output')?el('output').value:'';
  if(!prompt){alert('Genera un prompt primero.');return;}
  prompt=dalleRemap(translateES(prompt));
  const size=val('dalleSize')||'1024x1792';
  const quality=val('dalleQuality')||'hd';
  const n=Math.min(4,Math.max(1,parseInt(val('dalleN'),10)||1));
  const status=el('dalleStatus');
  const grid=el('dalleGrid');
  const warn=el('dalleExpiryWarn');
  if(!grid)return;
  if(status){status.style.display='block';status.style.color='var(--muted)';status.textContent='Generando '+n+' imagen'+(n>1?'es (llamadas paralelas)':'')+'...';}
  if(warn) warn.classList.remove('visible');
  const spinners=Array.from({length:n},(_,i)=>{
    const d=document.createElement('div');
    d.className='dalle-card';d.id='dalle-spinner-'+i;
    d.innerHTML=`<div class="dalle-spinner"><div class="dalle-generating"><div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div><span data-u-style="u057">Gen. ${i+1}/${n}...</span></div></div>`;
    grid.insertBefore(d,grid.firstChild);return d;
  });
  const singleCall=async()=>{
    const r=await fetch('https://api.openai.com/v1/images/generations',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+keys.openai},
      body:JSON.stringify({model:'dall-e-3',prompt:prompt.substring(0,4000),n:1,size,quality,response_format:'b64_json'})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error((e.error&&e.error.message)||'Error DALL·E '+r.status);}
    const data=await r.json();
    return data.data&&data.data[0]?data.data[0].b64_json:null;
  };
  try{
    const results=await Promise.allSettled(Array.from({length:n},()=>singleCall()));
    spinners.forEach(s=>s.remove());
    let ok=0;
    results.forEach((res,i)=>{
      if(res.status==='fulfilled'&&res.value){
        ok++;
        const dataUrl='data:image/png;base64,'+res.value;
        dalleImages.unshift({dataUrl,prompt:prompt.substring(0,150),date:new Date().toISOString()});
        const card=document.createElement('div');
        card.className='dalle-card';
        const img=document.createElement('img');
        img.src=dataUrl;img.alt='DALL·E '+(i+1);img.loading='lazy';img.onclick=()=>openLightbox(dataUrl);
        const p=document.createElement('div');p.className='dalle-card-prompt';p.textContent=prompt.substring(0,100)+'…';
        const f=document.createElement('div');f.className='dalle-card-footer';
        const b1=document.createElement('button');b1.className='kbtn';b1.textContent='↓ DL';b1.onclick=()=>downloadDalle(dataUrl,Date.now());
        const b2=document.createElement('button');b2.className='kbtn kbtn-adv';b2.textContent='+ Biblioteca';b2.onclick=()=>saveDalleToLibrary(dataUrl);
        f.append(b1,b2);card.append(img,p,f);grid.insertBefore(card,grid.firstChild);
      } else {
        const errCard=document.createElement('div');
        errCard.className='dalle-card';
        const msg=res.reason&&res.reason.message?res.reason.message:'Error desconocido';
        errCard.innerHTML=`<div class="dalle-spinner"><div data-u-style="u058">Error imagen ${i+1}<br>${escapeHTML(msg)}</div></div>`;
        grid.insertBefore(errCard,grid.firstChild);
      }
    });
    if(status) status.textContent='✓ '+ok+'/'+n+' imagen'+(ok>1?'es':'')+' generada'+(ok>1?'s':'')+' (base64, sin expiración)';
    if(warn) warn.classList.remove('visible');
  }catch(err){
    spinners.forEach(s=>s.remove());
    if(status){status.textContent='Error: '+err.message;status.style.color='var(--rose2)';}
  }
}

/* ── FIX: saveDalleToLibrary stores base64, never expires ── */
function saveDalleToLibrary(dataUrl){
  const results=JSON.parse(localStorage.getItem('psos14Results')||'[]');
  const prompt=el('output')?el('output').value:'';
  // Store full base64 — persists forever
  results.unshift({id:Date.now(),prompt:prompt.substring(0,200),url:dataUrl,notes:'Generado con DALL·E 3',score:0,date:new Date().toISOString(),cat:activeCat});
  localStorage.setItem('psos14Results',JSON.stringify(results.slice(0,200)));
  renderResults();refreshAnalytics();
  alert('Guardado en biblioteca ✓ (imagen permanente en base64)');
}

/* ── FIX: downloadDalle works with base64 ── */
async function downloadDalle(src,ts){
  if(src.startsWith('data:')){
    const a=document.createElement('a');a.href=src;
    a.download='dalle_'+(ts||Date.now())+'.png';a.click();
  } else {
    try{
      const r=await fetch(src);const blob=await r.blob();
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='dalle_'+(ts||Date.now())+'.png';a.click();URL.revokeObjectURL(a.href);
    }catch(e){window.open(src,'_blank');}
  }
}

/* ── SHARE BY URL ── */
const SHARE_FIELD_GROUPS={
  persona:['age','subjectType','ageRealism','bodytype','antiAge','sensual','expression','etnia','customEtnia','tonoPiel','rasgos'],
  outfit:['outfit-cotidiana','customOutfit-cotidiana','outfitDetail','outfit-gala','customOutfit-gala','galaDetail','outfit-lenceria','customOutfit-lenceria','lenceriaLayer','outfit-disfraz','customOutfit-disfraz','disfrazFit','disfrazProp','outfit-banyo','customOutfit-banyo','banyoScene','banyoAcc','outfit-deporte','customOutfit-deporte','deporteScene','deporteAcc','outfitColor','outfitColor2','outfitPattern','outfitFabric','shoes','customShoes','jewelry','customJewelry','accessories','customAccessories'],
  hair:['hairStyle','hairColor','hairFinish','hairAcc'],
  makeup:['makeupLook','lipColor','eyeMakeup','skinLook'],
  cam:['plano','angulo','lente'],// handled via camState
  scene:['scene','customScene','action','customAction','lighting'],
  output:['style','customStyle','mode','detail','format','safe','variation','amount'],
  legs:['legtype','legcolor','transparency','texture','height','legmode','customLegwear']
};
function openShare(){el('shareOverlay').classList.add('open');buildShareURL();}
function closeShare(){el('shareOverlay').classList.remove('open');}
function buildShareURL(){
  const state=captureState();
  // Filter based on toggles
  const included={cat:state.cat,cam:state.cam,lang:state.lang};
  Object.entries(SHARE_FIELD_GROUPS).forEach(([grp,fields])=>{
    const btn=el('stg-'+grp);
    if(btn&&!btn.classList.contains('on')) return;
    if(grp==='cam'){included.cam=state.cam;return;}
    fields.forEach(f=>{if(state[f]!==undefined) included[f]=state[f];});
  });
  const json=JSON.stringify(included);
  let encoded;
  try{encoded=btoa(unescape(encodeURIComponent(json)));}
  catch(e){encoded=btoa(json);}
  const url=window.location.href.split('?')[0].split('#')[0]+'?ps='+encoded;
  const box=el('shareURLBox');
  const lenEl=el('shareURLLen');
  if(box) box.textContent=url;
  if(lenEl) lenEl.textContent=url.length+' caracteres — '+Math.round(url.length/1024*100)/100+' KB';
  return url;
}
async function copyShareURL(){
  const box=el('shareURLBox');
  const url=box?box.textContent:'';
  if(!url||url.includes('Haz click')) {buildShareURL();return;}
  try{
    await navigator.clipboard.writeText(url);
    const orig=box.style.borderColor;
    box.style.borderColor='rgba(82,184,174,.6)';
    setTimeout(()=>box.style.borderColor=orig,1200);
    alert('Link copiado ✓');
  }catch(e){box&&box.select&&box.select();}
}
function loadFromURL(){
  const params=new URLSearchParams(window.location.search);
  const ps=params.get('ps');
  if(!ps) return;
  try{
    const json=decodeURIComponent(escape(atob(ps)));
    const state=JSON.parse(json);
    applyState(state);
    // Show banner
    const banner=document.createElement('div');
    banner.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(82,184,174,.15);border:1px solid rgba(82,184,174,.4);color:var(--teal);font-family:\'JetBrains Mono\',monospace;font-size:.72rem;padding:8px 18px;border-radius:99px;letter-spacing:.06em';
    banner.textContent='✓ Configuración cargada desde link compartido';
    document.body.appendChild(banner);
    setTimeout(()=>banner.remove(),3500);
    // Clean URL
    window.history.replaceState({},'',window.location.pathname);
  }catch(e){console.warn('Error loading shared state:',e);}
}


/* ── THEME TOGGLE ── */
function toggleTheme(){
  document.body.classList.toggle('light-mode');
  const btn=document.querySelector('.theme-btn');
  if(btn) btn.textContent=document.body.classList.contains('light-mode')?'🌒':'🌙';
  localStorage.setItem('psos14Theme',document.body.classList.contains('light-mode')?'light':'dark');
}
function loadTheme(){
  if(localStorage.getItem('psos14Theme')==='light'){
    document.body.classList.add('light-mode');
    const btn=document.querySelector('.theme-btn');
    if(btn) btn.textContent='🌒';
  }
}

/* ── KEYBOARD SHORTCUTS ── */
let kbdVisible=false;
function toggleKbd(){
  kbdVisible=!kbdVisible;
  const h=el('kbdHint');
  if(h) h.classList.toggle('visible',kbdVisible);
}
document.addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')){
    if(e.target.id==='chatInput'&&e.key==='Enter'){e.preventDefault();sendChat();}
    return;
  }
  if(e.ctrlKey||e.metaKey){
    switch(e.key){
      case 'g':e.preventDefault();generate();break;
      case 'r':e.preventDefault();randomCoherent();break;
      case 's':e.preventDefault();savePreset();break;
      case 'b':e.preventDefault();generateBatch();break;
      case '/':case '?':e.preventDefault();toggleKbd();break;
    }
  }
});

/* ── NEGATIVE PROMPT ── */
let negVisible=true;
function toggleNeg(){
  negVisible=!negVisible;
  const ta=el('negOutput');const btn=document.querySelector('#negWrap .api-toggle-btn');
  if(ta) ta.style.display=negVisible?'block':'none';
  if(btn) btn.textContent=negVisible?'Ocultar':'Mostrar';
}
function autoNegPrompt(){
  const format=val('format');
  const cat=activeCat;
  const base='deformed hands, extra fingers, missing fingers, distorted anatomy, unrealistic proportions, cartoon, anime, illustration, CGI, 3D render, painting, sketch, watermark, text, logo, blurry, low quality, bad lighting, overexposed, underexposed';
  const extras={lenceria:', visible underwear labels, seams misaligned',disfraz:', costume badly fitted, cheap fabric',banyo:', wet hair sticking awkwardly',deporte:', gym equipment in wrong place'};
  const age='teen appearance, child features, underage, infantilized appearance';
  let neg=base+(extras[cat]||'')+', '+age;
  if(format==='midjourney') neg='--no '+neg.split(',').slice(0,6).join(',');
  if(el('negOutput')) el('negOutput').value=neg;
}
async function copyNeg(){
  const t=el('negOutput');if(!t||!t.value)return;
  try{await navigator.clipboard.writeText(t.value);alert('Negativo copiado ✓');}catch(e){t.select();}
}

/* ── PRESET SEARCH (override renderPresets) ── */
const _origRenderPresets=window.renderPresets;
function renderPresets(){
  const list=safeJSON('psos14Presets',[]);
  const t=el('presetList');
  const badge=el('presetCountBadge');
  if(!t)return;
  if(badge) badge.textContent=list.length+' preset'+(list.length===1?'':'s');
  if(!list.length){t.innerHTML='<span data-u-style="u024">Sin presets guardados.</span>';return;}
  const activeTag=window._activeTagFilter||'all';
  const searchQ=(el('presetSearch')?el('presetSearch').value.trim().toLowerCase():'');
  let filtered=activeTag==='all'?list:list.filter(p=>p.state&&p.state.cat===activeTag);
  if(searchQ) filtered=filtered.filter(p=>String(p.name||'').toLowerCase().includes(searchQ));
  filtered.sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  if(!filtered.length){t.innerHTML='<span data-u-style="u024">Sin resultados.</span>';return;}
  const tagCls={cotidiana:'pcard-tag-cotidiana',gala:'pcard-tag-gala',lenceria:'pcard-tag-lenceria',disfraz:'pcard-tag-disfraz',banyo:'pcard-tag-banyo',deporte:'pcard-tag-deporte'};
  const tagLabel={cotidiana:'cotidiana',gala:'gala',lenceria:'layering',disfraz:'disfraz',banyo:'baño',deporte:'deporte'};
  t.innerHTML=`<div class="pcards">${filtered.map((p)=>{
    const realIdx=list.indexOf(p);
    const cat=p.state&&p.state.cat||'';
    const tc=tagCls[cat]||'';const tl=tagLabel[cat]||cat;
    const verCount=p.versions?p.versions.length:0;
    const isFav=!!p.fav;
    const useCount=p.useCount||0;
    return `<div class="pcard${isFav?' pcard-fav':''}">
      <div data-u-style="u059">
        <strong>${escapeHTML(p.name||'Preset sin nombre')}</strong>
        <button title="Favorito" data-onclick="toggleFavorite(${realIdx})" class="fav-star ${isFav?'lit':''}">${isFav?'★':'☆'}</button>
      </div>
      <div>${tc?`<span class="pcard-tag ${tc}">${escapeHTML(tl)}</span>`:''}${useCount>0?`<span data-u-style="u060">×${Number(useCount)||0}</span>`:''}</div>
      <span class="pdate">${escapeHTML(safeDate(p.date).toLocaleString())}${verCount?` · <span data-u-style="u061"><span class="ver-dot"></span>${verCount} versión${verCount>1?'es':''}</span>`:''}</span>
      <div class="row" data-u-style="u018">
        <button class="bg" data-u-style="u062" data-onclick="loadPreset(${realIdx})">Cargar</button>
        <button class="bt" data-u-style="u062" data-onclick="clonePreset(${realIdx})">⎘</button>
        ${verCount?`<button class="bg" data-u-style="u063" data-onclick="showVersions(${realIdx})">📋 v${verCount}</button>`:''}
        <button class="bd" data-u-style="u062" data-onclick="deletePreset(${realIdx})">✕</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* ── PRESET VERSION HISTORY ── */
function savePreset(){
  const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  const name=val('presetName')||'Preset sin nombre';
  // Check if same name exists → version it
  const existing=list.findIndex(p=>p.name===name);
  const state=captureState();
  if(existing>=0){
    const old=list[existing];
    if(!old.versions) old.versions=[];
    old.versions.unshift({state:old.state,date:old.date});
    if(old.versions.length>10) old.versions=old.versions.slice(0,10);
    old.state=state;old.date=new Date().toISOString();
  } else {
    list.unshift({name,date:new Date().toISOString(),state,versions:[]});
  }
  localStorage.setItem('psos14Presets',JSON.stringify(list.slice(0,80)));
  renderPresets();
}
function showVersions(idx){
  const list=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  const p=list[idx];if(!p||!p.versions||!p.versions.length){alert('Sin versiones anteriores.');return;}
  const names=p.versions.map((v,i)=>`v${i+1} · ${new Date(v.date).toLocaleString()}`).join('\n');
  const choice=prompt(`Versiones de "${p.name}":\n${names}\n\nEscribe el número (1-${p.versions.length}) para restaurar, o cancela:`);
  if(!choice)return;
  const vi=parseInt(choice)-1;
  if(isNaN(vi)||vi<0||vi>=p.versions.length){alert('Número inválido.');return;}
  if(confirm(`¿Restaurar versión ${vi+1}? La versión actual se guardará como nueva versión.`)){
    const current=p.state;
    p.versions.unshift({state:current,date:p.date});
    p.state=p.versions.splice(vi+1,1)[0].state;
    p.date=new Date().toISOString();
    localStorage.setItem('psos14Presets',JSON.stringify(list));
    applyState(p.state);renderPresets();
  }
}

/* ── DALL·E GENERATION ── */
let dalleImages=[];
function clearDalleGrid(){
  const g=el('dalleGrid');if(g)g.innerHTML='';
  dalleImages=[];
  const s=el('dalleStatus');if(s)s.style.display='none';
}


/* ── LIGHTBOX ── */
function openLightbox(src){
  const lb=el('lightbox');const img=el('lightboxImg');
  if(lb&&img){img.src=src;lb.classList.add('open');}
}
function closeLightbox(){
  const lb=el('lightbox');if(lb)lb.classList.remove('open');
}

/* ── RESULTS VIEW TOGGLE ── */
let resultsViewMode='list';
function toggleResultsView(){
  resultsViewMode=resultsViewMode==='list'?'gallery':'list';
  renderResults();
}

/* ── RESULTS RENDER (upgraded) ── */
function renderResults(){
  const allResults=safeJSON('psos14Results',[]);
  const minStar=parseInt(val('resultStarFilter')||'0');
  const catF=val('resultCatFilter')||'';
  const results=allResults.filter(r=>{
    if(minStar>0&&Number(r.score)<minStar)return false;
    if(catF&&r.cat!==catF)return false;
    return true;
  });
  const container=el('resultsList');if(!container)return;
  if(!results.length){container.innerHTML="<span data-u-style=\"u069\">Sin resultados guardados aún.</span>";return;}
  const isImg=url=>String(url||'').startsWith('data:image/')||/^https:\/\//i.test(String(url||''))&&String(url||'').match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)||String(url||'').startsWith('https://oaidalleapiprodscus');
  if(resultsViewMode==='gallery'){
    container.className='gallery-grid';
    container.innerHTML=results.map(r=>{
      const id=Number(r.id)||0;
      const url=String(r.url||'');
      const stars=[1,2,3,4,5].map(st=>`<span class="result-star${Number(r.score)>=st?' lit':''}">★</span>`).join('');
      const imgHtml=isImg(url)?`<img src="${escapeAttr(url)}" alt="" loading="lazy" data-onclick="openLightboxByResult(${id})" title="${escapeAttr(r.prompt||'')}"/>`:`<div data-u-style="u064">🖼</div>`;
      return `<div class="gallery-card">
        ${imgHtml}
        <button class="gallery-card-del" data-onclick="deleteResult(${id})">✕</button>
        <div class="gallery-card-info">
          <div class="gallery-card-stars">${stars}</div>
          ${r.notes?`<div class="gallery-card-notes">${escapeHTML(r.notes)}</div>`:''}
          <div data-u-style="u065">${escapeHTML(safeDate(r.date).toLocaleDateString())} · ${escapeHTML(r.cat||'')}</div>
        </div>
      </div>`;
    }).join('');
  } else {
    container.className='';
    container.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;margin-top:8px';
    container.innerHTML=results.map(r=>{
      const id=Number(r.id)||0;
      const url=String(r.url||'');
      const stars=[1,2,3,4,5].map(st=>`<span class="result-star${Number(r.score)>=st?' lit':''}">★</span>`).join('');
      const safeUrlLabel=url.substring(0,50)+(url.length>50?'…':'');
      return `<div class="result-card">
        <div class="result-card-prompt">${escapeHTML(r.prompt||'—')}</div>
        ${url?`<div class="result-url" data-onclick="openResultURL(${id})">${escapeHTML(safeUrlLabel)}</div>`:''}
        <div class="result-stars">${stars}</div>
        ${r.notes?`<div class="result-notes">${escapeHTML(r.notes)}</div>`:''}
        <div data-u-style="u066">
          <span data-u-style="u067">${escapeHTML(safeDate(r.date).toLocaleDateString())} · ${escapeHTML(r.cat||'')}</span>
          <button class="kbtn kbtn-del" data-onclick="deleteResult(${id})">✕</button>
        </div>
      </div>`;
    }).join('');
  }
}

/* ── PIPELINE DRAG & DROP ── */
function initKanbanDnD(){
  document.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault();col.classList.remove('drag-over');
      const id=parseInt(e.dataTransfer.getData('text/plain'));
      const stage=col.querySelector('[id^="kCol-"]')&&col.querySelector('[id^="kCol-"]').id.replace('kCol-','');
      if(id&&stage) movePipelineToStage(id,stage);
    });
  });
}
function movePipelineToStage(id,stage){
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  const item=pipeline.find(p=>p.id===id);
  if(item&&PIPELINE_STAGES.includes(stage)){item.stage=stage;localStorage.setItem('psos14Pipeline',JSON.stringify(pipeline));renderPipeline();}
}

/* ── EXPORT PIPELINE ── */
function exportPipeline(){
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  if(!pipeline.length){alert('El pipeline está vacío.');return;}
  const blob=new Blob([JSON.stringify(pipeline,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='photo_studio_pipeline_'+Date.now()+'.json';a.click();URL.revokeObjectURL(a.href);
}

/* ── SUGGESTION → CREATE PRESET ── */

function createPresetFromSuggestion(name,cat){
  const catIdx={cotidiana:0,gala:1,lenceria:2,disfraz:3,banyo:4,deporte:5};
  const idx=catIdx[cat];
  if(idx!==undefined) switchCat(cat,document.querySelectorAll('.cat-tab')[idx]);
  if(el('presetName')) el('presetName').value=name;
  savePreset();
  alert(`Preset "${name}" creado. Puedes cargarlo y configurarlo desde el panel de presets.`);
}

/* ── PIPELINE RENDER with drag ── */


/* ── ADD EXPORT PIPELINE BUTTON ── */
(function patchPipelineExport(){
  /* ── BACKUP COMPLETO ── */
function backupAll(){
  const data={
    version:'psv9-backup-v1',
    date:new Date().toISOString(),
    presets:JSON.parse(localStorage.getItem('psos14Presets')||'[]'),
    pipeline:JSON.parse(localStorage.getItem('psos14Pipeline')||'[]'),
    results:JSON.parse(localStorage.getItem('psos14Results')||'[]'),
    history:JSON.parse(localStorage.getItem('psos14History')||'[]'),
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='photo_studio_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();URL.revokeObjectURL(a.href);
}
function restoreBackup(){el('restoreFile')&&el('restoreFile').click();}
function doRestoreBackup(input){
  const file=input.files[0];if(!file)return;
  if(file.size>2*1024*1024){alert('Archivo demasiado grande. Máximo 2 MB para proteger el navegador.');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.version||!data.version.startsWith('psv9')){alert('Archivo de backup no válido.');return;}
      if(!confirm('¿Restaurar backup? Esto sobrescribirá presets, pipeline, biblioteca e historial actuales.'))return;
      if(data.presets) localStorage.setItem('psos14Presets',JSON.stringify(data.presets));
      if(data.pipeline) localStorage.setItem('psos14Pipeline',JSON.stringify(data.pipeline));
      if(data.results) localStorage.setItem('psos14Results',JSON.stringify(data.results));
      if(data.history) localStorage.setItem('psos14History',JSON.stringify(data.history));
      renderPresets();renderPipeline();renderResults();renderHistory();refreshAnalytics();
      alert('✓ Backup restaurado correctamente ('+new Date(data.date).toLocaleString()+')');
    }catch(err){alert('Error al leer el backup: '+err.message);}
  };
  reader.readAsText(file);
  input.value='';
}

document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.querySelector('[onclick="clearPipeline()"]');
    if(btn&&btn.parentNode){
      const exp=document.createElement('button');
      exp.className='bg';exp.textContent='↓ Export pipeline';
      exp.onclick=exportPipeline;
      btn.parentNode.insertBefore(exp,btn.nextSibling);
    }
  });
})();

/* ── FIX applyChatConfig to include cam pills ── */



/* ── API KEYS ── */
function saveKeys(){
  const keys={
    anthropic:el('keyAnthropic')?el('keyAnthropic').value.trim():'',
    gemini:el('keyGemini')?el('keyGemini').value.trim():'',
    openai:el('keyOpenAI')?el('keyOpenAI').value.trim():''
  };
  sessionStorage.setItem('psv9SessionKeys',JSON.stringify(keys));
  localStorage.setItem('psv9KeyPrefs',JSON.stringify({model:val('activeModel')}));
  updateKeyStatus();
}
function loadKeys(){
  try{
    const legacy=JSON.parse(localStorage.getItem('psv9Keys')||'{}');
    if(legacy.anthropic||legacy.gemini||legacy.openai){
      sessionStorage.setItem('psv9SessionKeys',JSON.stringify({anthropic:legacy.anthropic||'',gemini:legacy.gemini||'',openai:legacy.openai||''}));
      localStorage.removeItem('psv9Keys');
    }
  }catch(e){}
  try{
    const k=safeSessionJSON('psv9SessionKeys',{});
    if(k.anthropic&&el('keyAnthropic')) el('keyAnthropic').value=k.anthropic;
    if(k.gemini&&el('keyGemini')) el('keyGemini').value=k.gemini;
    if(k.openai&&el('keyOpenAI')) el('keyOpenAI').value=k.openai;
    const prefs=JSON.parse(localStorage.getItem('psv9KeyPrefs')||'{}');
    if(prefs.model&&el('activeModel')) el('activeModel').value=prefs.model;
  }catch(e){}
  updateKeyStatus();
}
function clearKeys(){
  if(!confirm('¿Borrar todas las API keys de esta sesión?'))return;
  sessionStorage.removeItem('psv9SessionKeys');
  localStorage.removeItem('psv9Keys');
  ['keyAnthropic','keyGemini','keyOpenAI'].forEach(id=>{if(el(id))el(id).value='';});
  updateKeyStatus();
}
function toggleKeyVis(id,btn){
  const inp=el(id);if(!inp)return;
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.textContent=show?'🙈 Ocultar':'👁 Ver';
}
function updateKeyStatus(){
  const check=(keyId,statusId)=>{
    const v=el(keyId)?el(keyId).value.trim():'';
    const s=el(statusId);
    if(s){s.className='api-status '+(v?'ok':'empty');}
  };
  check('keyAnthropic','statusAnthropic');
  check('keyGemini','statusGemini');
  check('keyOpenAI','statusOpenAI');
}
function getKeys(){
  return safeSessionJSON('psv9SessionKeys',{});
}
function getActiveProvider(){
  const m=val('activeModel')||'anthropic|claude-sonnet-4-20250514';
  const [provider,model]=m.split('|');
  return{provider,model};
}
function getActiveKey(){
  const k=getKeys();
  const {provider}=getActiveProvider();
  return k[provider]||'';
}

/* ── CALL AI ── */
async function callAI(systemPrompt,userPrompt){
  const {provider,model}=getActiveProvider();
  const keys=getKeys();
  const key=keys[provider]||'';
  if(!key) throw new Error('No hay API key para '+provider+'. Añádela en el panel de keys.');

  if(provider==='anthropic'){
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model,max_tokens:1200,system:systemPrompt,messages:[{role:'user',content:userPrompt}]})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error((e.error&&e.error.message)||'Error Anthropic '+r.status);}
    const d=await r.json();
    return d.content&&d.content[0]?d.content[0].text:'';
  }
  if(provider==='gemini'){
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({system_instruction:{parts:[{text:systemPrompt}]},contents:[{role:'user',parts:[{text:userPrompt}]}]})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error((e.error&&e.error.message)||'Error Gemini '+r.status);}
    const d=await r.json();
    return d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts[0]?d.candidates[0].content.parts[0].text:'';
  }
  if(provider==='openai'){
    const r=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model,max_tokens:1200,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}]})
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error((e.error&&e.error.message)||'Error OpenAI '+r.status);}
    const d=await r.json();
    return d.choices&&d.choices[0]?d.choices[0].message.content:'';
  }
  throw new Error('Proveedor no soportado: '+provider);
}

/* ── AI MODE TABS ── */
let activeAIMode='evaluar';
function switchAIMode(mode,btn){
  activeAIMode=mode;
  document.querySelectorAll('.ai-mode-panel').forEach(p=>p.style.display='none');
  const panel=el('aimode-'+mode);
  if(panel) panel.style.display='block';
  document.querySelectorAll('#aiModeTabs .cat-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

/* ── AI ACTIONS ── */
async function aiAction(mode){
  const key=getActiveKey();
  if(!key){alert('Añade una API key en el panel de keys primero.');return;}
  const prompt=el('output')?el('output').value:'';
  const {provider,model}=getActiveProvider();
  const providerLabel=provider.charAt(0).toUpperCase()+provider.slice(1)+' · '+model;
  const respBox=el('aiResp-'+mode);
  const respContent=el('aiRespContent-'+mode);
  const tag=el('aiTag-'+mode);
  if(respBox) respBox.classList.add('visible');
  if(tag){tag.textContent=providerLabel;tag.className='ai-response-provider-tag api-'+provider;}
  if(respContent) respContent.innerHTML='<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span data-u-style="u068">Procesando...</span></div>';

  try{
    let sys='',usr='';
    if(mode==='evaluar'){
      sys='Eres un experto en prompt engineering para generadores de imagen de IA (ChatGPT DALL·E, Midjourney, Gemini, FLUX). Analiza prompts de fotografía profesional para retrato, moda, editorial, lifestyle, beauty, campañas comerciales y senior photography, con atención a diversidad, tono de piel, styling, pose, luz, composición, coherencia anatómica y compatibilidad con filtros. Responde en español.';
      usr=`Evalúa este prompt de fotografía:\n\n"${prompt}"\n\nProporciona:\n1. PUNTUACIÓN (0-10) con justificación\n2. FORTALEZAS (qué funciona bien)\n3. DEBILIDADES (qué puede fallar en la IA)\n4. INCOHERENCIAS detectadas (si las hay)\n5. SUGERENCIA RÁPIDA de mejora en una frase`;
    } else if(mode==='mejorar'){
      sys='Eres un experto en prompt engineering para generadores de imagen de IA. Reescribes prompts de fotografía para maximizar su efectividad y coherencia. Devuelves SOLO el prompt mejorado, sin explicaciones adicionales, listo para copiar.';
      usr=`Mejora y optimiza este prompt de fotografía de moda:\n\n"${prompt}"\n\nMantén la esencia pero:\n- Mejora la coherencia visual\n- Añade detalles técnicos de calidad fotográfica\n- Elimina redundancias\n- Estructura para máxima efectividad en IA generativa\nDevuelve SOLO el prompt mejorado.`;
    } else if(mode==='sugerir'){
      const presets=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
      const presetSummary=presets.slice(0,15).map(p=>`- ${p.name} (${p.state&&p.state.cat||'?'})`).join('\n');
      sys='Eres un analista creativo de sesiones fotográficas. Analizas colecciones de presets y sugieres nuevas combinaciones que amplíen la variedad. Responde en español con formato estructurado.';
      usr=`Analiza estos presets guardados:\n${presetSummary||'(sin presets aún)'}\n\nSugiere 4 NUEVAS IDEAS de preset que:\n1. Complementen lo existente\n2. Exploren ángulos no cubiertos\n3. Sean coherentes con el estilo (fotografía profesional general, con senior photography como especialidad)\n\nPara cada idea:\nTÍTULO: [nombre del preset]\nCATEGORÍA: [cotidiana/gala/lenceria/disfraz/banyo/deporte]\nCONCEPTO: [descripción en 2 líneas]\nPOR QUÉ: [razón para añadirlo a tu colección]`;
    }
    const result=await callAI(sys,usr);
    if(mode==='sugerir'){
      el('aiResp-'+mode)&&(el('aiResp-'+mode).classList.remove('visible'));
      renderSuggestions(result);
    } else {
      if(respContent) respContent.innerHTML=escapeHTML(result).replace(/\n/g,'<br>');
    }
  }catch(err){
    if(respContent) respContent.innerHTML='<span data-u-style="u047">Error: '+escapeHTML(err.message)+'</span>';
  }
  refreshAnalytics();
}

function renderSuggestions(text){
  const container=el('sugestorResult');
  if(!container)return;
  container.style.display='flex';
  const safeText=String(text||'');
  const blocks=safeText.split(/TÍTULO:|título:/i).filter(b=>b.trim());
  if(!blocks.length){container.innerHTML=`<div class="sug-card"><div class="sug-card-reason">${escapeHTML(safeText).replace(/\n/g,'<br>')}</div></div>`;return;}
  container.innerHTML=blocks.map(b=>{
    const lines=b.trim().split('\n').filter(l=>l.trim());
    const title=lines[0]?lines[0].replace(/^[\:\-\s]+/,'').trim():'Sugerencia';
    const rest=escapeHTML(lines.slice(1).join('\n')).replace(/\n/g,'<br>').replace(/(CATEGORÍA|CONCEPTO|POR QUÉ):/g,'<strong>$1:</strong>');
    return `<div class="sug-card"><div class="sug-card-title">${escapeHTML(title)}</div><div class="sug-card-reason">${rest}</div></div>`;
  }).join('');
}

function applyImprovedPrompt(){
  const content=el('aiRespContent-mejorar');
  if(!content||!content.textContent.trim()){alert('Primero genera el prompt mejorado.');return;}
  const text=content.innerText||content.textContent;
  if(el('output')) el('output').value=text.trim();
  updateTokenCounter(text.trim());
}

/* ── NATURAL LANGUAGE CHAT ── */
let chatHistory=[];
async function sendChat(){
  const inp=el('chatInput');
  const msg=inp?inp.value.trim():'';
  if(!msg)return;
  const key=getActiveKey();
  if(!key){appendChatMsg('system','⚠ Añade una API key en el panel de keys para usar el chat.');return;}
  inp.value='';
  appendChatMsg('user',msg);
  appendChatMsg('ai','<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>');

  const sys=`Eres el asistente de Photo Studio OS, una app para generar prompts de fotografía profesional general: retrato, moda, editorial, lifestyle, beauty, commercial y senior photography.

El usuario describe en lenguaje natural la sesión fotográfica que quiere. Tu trabajo es:
1. Entender su petición
2. Responder en español con entusiasmo y concisión
3. Al final de tu respuesta, incluir un bloque JSON con los campos a configurar, en este formato EXACTO:

<<<CONFIG
{
  "age": "35 años",
  "subjectType": "persona adulta",
  "cat": "gala",
  "sensual": "soft",
  "outfitColor": "azul marino",
  "lighting": "luz de estudio suave y limpia",
  "scene": "estudio fotográfico con fondo neutro",
  "hairColor": "cabello castaño oscuro natural",
  "makeupLook": "maquillaje natural suave, piel luminosa",
  "shoes": "zapatos negros cerrados elegantes",
  "expression": "mirada directa con confianza"
}
>>>

Solo incluye los campos que sean relevantes para la petición del usuario. Campos disponibles: age, subjectType, cat (cotidiana/gala/lenceria/disfraz/banyo/deporte), sensual (off/soft/medium/high), outfitColor, lighting, scene, hairColor, hairStyle, makeupLook, shoes, expression, bodytype, legtype, legcolor, style, ageRealism.`;

  chatHistory.push({role:'user',content:msg});
  try{
    const {provider,model}=getActiveProvider();
    const key2=getKeys()[provider]||'';
    let result='';
    if(provider==='anthropic'){
      const r=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key2,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model,max_tokens:900,system:sys,messages:chatHistory})
      });
      if(!r.ok)throw new Error('Error '+r.status);
      const d=await r.json();result=d.content&&d.content[0]?d.content[0].text:'';
    } else if(provider==='gemini'){
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key2}`;
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:sys}]},contents:chatHistory.map(m=>({role:m.role==='assistant'?'model':m.role,parts:[{text:m.content}]}))})});
      if(!r.ok)throw new Error('Error '+r.status);
      const d=await r.json();result=d.candidates&&d.candidates[0]?d.candidates[0].content.parts[0].text:'';
    } else if(provider==='openai'){
      const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key2},body:JSON.stringify({model,max_tokens:900,messages:[{role:'system',content:sys},...chatHistory]})});
      if(!r.ok)throw new Error('Error '+r.status);
      const d=await r.json();result=d.choices&&d.choices[0]?d.choices[0].message.content:'';
    }
    chatHistory.push({role:'assistant',content:result});saveChatHistory();saveChatHistory();
    // Extract and apply config
    const configMatch=result.match(/<<<CONFIG\s*([\s\S]*?)>>>/);
    let displayText=result.replace(/<<<CONFIG[\s\S]*?>>>/,'').trim();
    const messages=el('chatMessages');
    if(messages){const last=messages.lastChild;if(last)messages.removeChild(last);}
    appendChatMsg('ai',displayText||'Configuración aplicada.');
    if(configMatch){
      try{
        const cfg=JSON.parse(configMatch[1]);
        applyChatConfig(cfg);
        appendChatMsg('system','✓ Campos configurados automáticamente · Prompt actualizado');
      }catch(e){appendChatMsg('system','⚠ No se pudo parsear la configuración automática.');}
    }
  }catch(err){
    const messages=el('chatMessages');
    if(messages){const last=messages.lastChild;if(last)messages.removeChild(last);}
    appendChatMsg('system','Error: '+err.message);
  }
}
function applyChatConfig(cfg){
  const catMap={cotidiana:0,gala:1,lenceria:2,disfraz:3,banyo:4,deporte:5};
  if(cfg.cat){const idx=catMap[cfg.cat];if(idx!==undefined){switchCat(cfg.cat,document.querySelectorAll('.cat-tab')[idx]);}}
  const fieldMap={age:'age',subjectType:'subjectType',sensual:'sensual',outfitColor:'outfitColor',lighting:'lighting',scene:'scene',
    hairColor:'hairColor',hairStyle:'hairStyle',makeupLook:'makeupLook',shoes:'shoes',
    expression:'expression',bodytype:'bodytype',legtype:'legtype',legcolor:'legcolor',
    style:'style',ageRealism:'ageRealism',etnia:'etnia',tonoPiel:'tonoPiel',rasgos:'rasgos'};
  Object.entries(fieldMap).forEach(([cfgKey,fieldId])=>{if(cfg[cfgKey])setVal(fieldId,cfg[cfgKey]);});
  applySubjectContext({preserveValues:false});
  updateEditorialUI();updateHairSwatch();updateLipSwatch();updateOutfitSwatch();updateLegSwatch();
  generate();
}
function appendChatMsg(role,html){
  const msgs=el('chatMessages');if(!msgs)return;
  const d=document.createElement('div');
  d.className='chat-msg '+role;
  if(String(html||'').includes('ai-thinking')) d.innerHTML=html;
  else d.innerHTML=escapeHTML(html).replace(/\n/g,'<br>');
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
}

function clearChat(){chatHistory=[];localStorage.removeItem('psos14Chat');const m=el('chatMessages');if(m)m.innerHTML='<div class="chat-msg system">Chat reiniciado. Describe la sesión fotográfica que imaginas.</div>';}
function saveChatHistory(){try{localStorage.setItem('psos14Chat',JSON.stringify(chatHistory.slice(-20)));}catch(e){}}
function loadChatHistory(){try{const saved=JSON.parse(localStorage.getItem('psos14Chat')||'[]');if(saved.length){chatHistory=saved;const m=el('chatMessages');if(m){saved.forEach(msg=>{appendChatMsg(msg.role==='user'?'user':'ai','[Sesión anterior] '+msg.content.substring(0,120)+'…');});}}}catch(e){}}

/* ── ANALYTICS ── */
function refreshAnalytics(){
  const hist=JSON.parse(localStorage.getItem('psos14History')||'[]');
  const presets=JSON.parse(localStorage.getItem('psos14Presets')||'[]');
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  const results=JSON.parse(localStorage.getItem('psos14Results')||'[]');
  const setN=(id,v)=>{const n=el(id);if(n)n.textContent=v};
  setN('statPrompts',hist.length);
  setN('statPresets',presets.length);
  setN('statPipeline',pipeline.length);
  setN('statResults',results.length);
  // Bar chart by category
  const cats={cotidiana:0,gala:0,lenceria:0,disfraz:0,banyo:0,deporte:0};
  presets.forEach(p=>{if(p.state&&p.state.cat&&cats.hasOwnProperty(p.state.cat))cats[p.state.cat]++;});
  const max=Math.max(...Object.values(cats),1);
  const labels={cotidiana:'Casual',gala:'Formal',lenceria:'Layering',disfraz:'Character',banyo:'Resort',deporte:'Sport'};
  const chart=el('catBarChart');
  if(chart) chart.innerHTML=Object.entries(cats).map(([k,v])=>
    `<div class="bar-row"><span class="bar-label">${labels[k]}</span><div class="bar-track"><div class="bar-fill" data-bar-width="${Math.round(v/max*100)}"></div></div><span class="bar-val">${v}</span></div>`
  ).join('');
  applyDynamicStyles();
}

/* ── PIPELINE ── */
const PIPELINE_STAGES=['pending','generated','reviewed','published'];
const STAGE_LABELS={pending:'Pendiente',generated:'Generado',reviewed:'Revisado',published:'Publicado'};
function addToPipeline(){
  const prompt=el('output')?el('output').value:'';
  if(!prompt){alert('Genera un prompt primero.');return;}
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  const name=prompt.substring(0,60)+'…';
  pipeline.unshift({id:Date.now(),name,prompt,stage:'pending',date:new Date().toISOString(),cat:activeCat,score:0});
  localStorage.setItem('psos14Pipeline',JSON.stringify(pipeline.slice(0,100)));
  renderPipeline();refreshAnalytics();
}
function advancePipeline(id){
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  const item=pipeline.find(p=>p.id===id);
  if(!item)return;
  const idx=PIPELINE_STAGES.indexOf(item.stage);
  if(idx<PIPELINE_STAGES.length-1) item.stage=PIPELINE_STAGES[idx+1];
  localStorage.setItem('psos14Pipeline',JSON.stringify(pipeline));
  renderPipeline();refreshAnalytics();
}
function deletePipeline(id){
  let pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  pipeline=pipeline.filter(p=>p.id!==id);
  localStorage.setItem('psos14Pipeline',JSON.stringify(pipeline));
  renderPipeline();refreshAnalytics();
}
function setPipelineScore(id,score){
  const pipeline=JSON.parse(localStorage.getItem('psos14Pipeline')||'[]');
  const item=pipeline.find(p=>p.id===id);
  if(item){item.score=score;localStorage.setItem('psos14Pipeline',JSON.stringify(pipeline));renderPipeline();}
}
function loadPipelinePrompt(id){
  const pipeline=safeJSON('psos14Pipeline',[]);
  const item=pipeline.find(p=>Number(p.id)===Number(id));
  if(!item)return;
  if(el('output')) el('output').value=String(item.prompt||'');
  updateTokenCounter(el('output').value);
}
function clearPipeline(){if(confirm('¿Vaciar todo el pipeline?')){localStorage.removeItem('psos14Pipeline');renderPipeline();refreshAnalytics();}}
function renderPipeline(){
  const pipeline=safeJSON('psos14Pipeline',[]);
  PIPELINE_STAGES.forEach(stage=>{
    const col=el('kCol-'+stage);
    const count=el('kCount-'+stage);
    const items=pipeline.filter(p=>p.stage===stage);
    if(count) count.textContent=items.length;
    if(!col)return;
    col.innerHTML=items.map(item=>{
      const id=Number(item.id)||0;
      const stars=[1,2,3,4,5].map(st=>`<span class="pipeline-star${Number(item.score)>=st?' lit':''}" data-onclick="setPipelineScore(${id},${st})">★</span>`).join('');
      const nextStage=PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage)+1];
      const prompt=String(item.prompt||'');
      return `<div class="kanban-card" title="${escapeAttr(prompt)}">
        <div class="kanban-card-name">${escapeHTML(item.name||'Prompt sin nombre')}</div>
        <div class="kanban-card-meta">${escapeHTML(safeDate(item.date).toLocaleDateString())} · ${escapeHTML(item.cat||'')}</div>
        <div class="pipeline-score">${stars}</div>
        <div class="kanban-card-actions">
          ${nextStage?`<button class="kbtn kbtn-adv" data-onclick="advancePipeline(${id})">→ ${escapeHTML(STAGE_LABELS[nextStage])}</button>`:''}
          <button class="kbtn" data-onclick="loadPipelinePrompt(${id})">Cargar</button>
          <button class="kbtn kbtn-del" data-onclick="deletePipeline(${id})">✕</button>
        </div>
      </div>`;
    }).join('');
  });
}

/* ── BIBLIOTECA RESULTADOS ── */
let currentResultStar=0;
function setResultStar(n){
  currentResultStar=n;
  document.querySelectorAll('#resultStarsInput .result-star').forEach((s,i)=>{
    s.classList.toggle('lit',i<n);
  });
}
function saveResult(){
  const url=val('resultUrl');
  const notes=val('resultNotes');
  const prompt=el('output')?el('output').value:'';
  if(!prompt&&!url){alert('Genera un prompt o añade una URL.');return;}
  const results=JSON.parse(localStorage.getItem('psos14Results')||'[]');
  results.unshift({id:Date.now(),prompt:prompt.substring(0,200),url,notes,score:currentResultStar,date:new Date().toISOString(),cat:activeCat});
  localStorage.setItem('psos14Results',JSON.stringify(results.slice(0,200)));
  setResultStar(0);
  if(el('resultUrl'))el('resultUrl').value='';
  if(el('resultNotes'))el('resultNotes').value='';
  renderResults();refreshAnalytics();
}
function deleteResult(id){
  let results=JSON.parse(localStorage.getItem('psos14Results')||'[]');
  results=results.filter(r=>r.id!==id);
  localStorage.setItem('psos14Results',JSON.stringify(results));
  renderResults();refreshAnalytics();
}
function resultById(id){return safeJSON('psos14Results',[]).find(r=>Number(r.id)===Number(id));}
function openLightboxByResult(id){const r=resultById(id);if(r&&r.url)openLightbox(String(r.url));}
function openResultURL(id){
  const r=resultById(id);if(!r||!r.url)return;
  const url=String(r.url);
  if(url.startsWith('data:image/')||url.startsWith('https://oaidalleapiprodscus')||url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)){openLightbox(url);return;}
  try{const u=new URL(url);if(['https:','http:'].includes(u.protocol))window.open(u.href,'_blank','noopener,noreferrer');}
  catch(e){alert('URL no válida.');}
}
function clearResults(){if(confirm('¿Borrar toda la biblioteca de resultados?')){localStorage.removeItem('psos14Results');renderResults();refreshAnalytics();}}


document.addEventListener('DOMContentLoaded',()=>{
  loadTheme();
  updateEditorialUI();
  applySubjectContext({preserveValues:false,forceLegDefaults:true});
  updateHairSwatch();updateLipSwatch();updateOutfitSwatch();updateOutfitSwatch2();updateLegSwatch();updateTonoPielSwatch();
  loadStarterPresets();
  renderHistory();renderPresets();
  renderPipeline();renderResults();refreshAnalytics();
  loadKeys();
  initKanbanDnD();
  loadFromURL(); // v9.5: load shared state from URL if present
  loadChatHistory();
  // Wire live update to all selects and inputs
  document.querySelectorAll('select,input').forEach(n=>{
    if(n.id==='output'||n.id==='presetName'||n.id==='importFile') return;
    if(n.id==='keyAnthropic'||n.id==='keyGemini'||n.id==='keyOpenAI') return;
    if(n.id==='presetSearch'||n.id==='resultStarFilter'||n.id==='resultCatFilter') return;
    n.addEventListener('change',()=>{
      if(n.id==='subjectType') applySubjectContext({preserveValues:false,forceLegDefaults:true});
      updateSkinSwatch();updateHairSwatch();updateLipSwatch();updateOutfitSwatch();updateOutfitSwatch2();updateLegSwatch();
      updateEditorialUI();scheduleLive();
    });
    if(n.tagName==='INPUT') n.addEventListener('input',scheduleLive);
  });
  generate();
});
