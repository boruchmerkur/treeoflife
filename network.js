/* Tree of Life Network — central link map.
   Edit this ONE file, redeploy it, and every site updates.
   Hosted at: https://thetreeoflifebooks.com/network.js
   Each site loads it with: <script src="https://thetreeoflifebooks.com/network.js" data-site="ID" defer></script>
*/
(function () {
  'use strict';

  var ORG = {
    treeoflife: { name: 'Tree of Life Books', url: 'https://thetreeoflifebooks.com',
      sameAs: ['https://www.facebook.com/RabbiBoruch',
               'https://www.instagram.com/rabbiboruchmerkur',
               'https://www.youtube.com/@rabbiboruchmerkur'] },
    dreamsite:  { name: 'DreamSite Design', url: 'https://dreamsitedesign.com', sameAs: [] },
    brandon:    { name: 'Brandon Russell', url: 'https://brandonrussell.art', sameAs: [] },
    merkur:     { name: 'Merkur Collection', url: 'https://merkur-collection.netlify.app', sameAs: [] }
  };

  /* id : label, url, org, links[], live */
  var S = {
    rabbiboruch:   { label: 'Rabbi Boruch',        url: 'https://rabbiboruch.com',        org: 'treeoflife', person: 'Rabbi Boruch Merkur', links: ['treeoflife','rebbesletters','torahcodes','shuk'] },
    treeoflife:    { label: 'Tree of Life Books',  url: 'https://thetreeoflifebooks.com', org: 'treeoflife', links: ['rabbiboruch','rebbesletters','beismoshiach'] },
    rebbesletters: { label: "The Rebbe's Letters", url: 'https://rebbesletters.com',      org: 'treeoflife', links: ['rabbiboruch','treeoflife','beismoshiach'] },
    torahcodes:    { label: 'Torah Codes',         url: 'https://torahcodes.online',      org: 'treeoflife', links: ['rabbiboruch','treeoflife'] },
    beismoshiach:  { label: 'Beis Moshiach',       url: 'https://beismoshiach.org',       org: 'treeoflife', links: ['rabbiboruch','moshiach101'] },
    moshiach101:   { label: 'Moshiach 101',        url: 'https://moshiach101.info',       org: 'treeoflife', links: ['rabbiboruch','beismoshiach','torahcodes'] },
    noahide:       { label: 'Noahide Life',        url: 'https://noahide.life',           org: 'treeoflife', links: ['rabbiboruch','torahcodes','shuk'] },
    shuk:          { label: 'Shuk',                url: 'https://shuk.world',             org: 'treeoflife', links: ['rabbiboruch','shuklove'] },
    shuklove:      { label: 'Shuk.Love',           url: 'https://shuk.love',              org: 'treeoflife', links: ['shuk','noahide'] },
    dreamsite:     { label: 'DreamSite Design',    url: 'https://dreamsitedesign.com',    org: 'dreamsite',  links: ['treeoflife','shuk','torahcodes','verifiedfree'] },
    verifiedfree:  { label: 'Verified Free',       url: 'https://verifiedfree.com',       org: 'dreamsite',  links: ['dreamsite'] },
    theguy:        { label: 'The Guy',             url: 'https://theguy.rocks',           org: 'dreamsite',  links: ['dreamsite'], live: false },
    brandonrussell:{ label: 'Brandon Russell',     url: 'https://brandonrussell.art',     org: 'brandon',    links: [] },
    add120:        { label: 'add120',              url: 'https://add120.life',            org: 'brandon',    links: [] },
    merkur:        { label: 'Merkur Collection',   url: 'https://merkur-collection.netlify.app', org: 'merkur', links: [] }
  };

  var tag = document.currentScript || document.querySelector('script[data-site]');
  if (!tag) return;
  var me = S[tag.getAttribute('data-site')];
  if (!me) return;

  var out = [];
  for (var i = 0; i < me.links.length; i++) {
    var t = S[me.links[i]];
    if (t && t.live !== false) out.push(t);
  }

  var nav = document.querySelector('nav.toln');
  if (out.length) {
    if (!nav) {
      var css = document.createElement('style');
      css.textContent = '.toln{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 10px;padding:8px 16px;font:400 11px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;border-top:1px solid rgba(128,128,128,.1);color:rgba(128,128,128,.45)}.toln a{color:inherit;text-decoration:none}.toln a:hover{color:rgba(128,128,128,.85);text-decoration:underline}.toln .d{color:rgba(128,128,128,.2)}@media(prefers-color-scheme:dark){.toln{border-top-color:rgba(200,200,200,.07);color:rgba(200,200,200,.35)}.toln a:hover{color:rgba(200,200,200,.8)}.toln .d{color:rgba(200,200,200,.15)}}';
      document.head.appendChild(css);
      nav = document.createElement('nav');
      nav.className = 'toln';
      nav.setAttribute('aria-label', 'Related sites');
      (document.querySelector('footer') || document.body).appendChild(nav);
    }
    var h = '';
    for (var k = 0; k < out.length; k++) {
      if (k) h += '<span class="d">\u00b7</span>';
      h += '<a href="' + out[k].url + '">' + out[k].label + '</a>';
    }
    nav.innerHTML = h;
  }

  var org = ORG[me.org];
  var pub = { '@type': 'Organization', name: org.name, url: org.url };
  if (org.sameAs.length) pub.sameAs = org.sameAs;
  var site = { '@type': 'WebSite', name: me.label, url: me.url, publisher: pub };
  var data = me.person
    ? { '@context': 'https://schema.org', '@graph': [site,
        { '@type': 'Person', name: me.person, url: me.url, affiliation: pub, sameAs: org.sameAs }] }
    : (site['@context'] = 'https://schema.org', site);

  var old = document.getElementById('toln-ld');
  if (old) old.remove();
  var ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.id = 'toln-ld';
  ld.textContent = JSON.stringify(data);
  document.head.appendChild(ld);
})();
