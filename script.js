/* script.js
 - projects.json'den projeleri yükler
 - kategoriler oluşturur: Beats, Vfxs, Gfxs
 - video projeleri için rastgele frame'den thumbnail üretir (canvas -> dataURL)
 - modal ile büyüteç / oynatma sağlar
*/

document.addEventListener('DOMContentLoaded', async () => {
  const categoriesContainer = document.getElementById('categories');
  const grid = document.getElementById('project-grid');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const modalBack = document.getElementById('modal-back');

  // sabit kategoriler (isteğe göre projects.json ile arttırılabilir)
  const CATEGORIES = ['Beats','Vfxs','Gfxs'];

  // yükle projects.json
  let projects = [];
  try {
    const res = await fetch('projects.json');
    projects = await res.json();
  } catch (e) {
    console.error('projects.json yüklenemedi:', e);
    grid.innerHTML = '<p class="muted">Projeler yüklenemedi (projects.json eksik veya hatalı).</p>';
    return;
  }

  // kategori butonlarını oluştur
  CATEGORIES.forEach((cat, i) => {
    const b = document.createElement('button');
    b.className = 'cat-btn' + (i===0 ? ' active' : '');
    b.textContent = cat;
    b.dataset.cat = cat;
    b.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderCategory(cat);
    });
    categoriesContainer.appendChild(b);
  });

  // ilk kategori render
  renderCategory(CATEGORIES[0]);

  // render fonksiyonu
  function renderCategory(category) {
    grid.innerHTML = '';
    const list = projects.filter(p => p.category === category);
    if(!list.length){
      grid.innerHTML = '<p class="muted">Bu kategoride proje yok.</p>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'thumb-wrap';

      const img = document.createElement('img');
      img.className = 'thumbnail';
      img.alt = p.title || '';
      // loader
      const loader = document.createElement('div');
      loader.className = 'loader';

      thumbWrap.appendChild(img);
      thumbWrap.appendChild(loader);
      card.appendChild(thumbWrap);

      const body = document.createElement('div');
      body.className = 'card-body';
      body.innerHTML = `<div class="card-title">${escapeHtml(p.title||'Untitled')}</div>
                        <div class="card-sub">${escapeHtml(p.type || '')}</div>`;
      card.appendChild(body);

      grid.appendChild(card);

      // set thumbnail: varsa projects.json içindeki thumbnail'i kullan,
      // yoksa video için rastgele frame üret (sadece video türü için)
      if (p.thumbnail && p.thumbnail.trim() !== '') {
        img.src = p.thumbnail;
        loader.remove();
      } else if (p.type === 'video') {
        // generate random frame thumbnail
        generateVideoThumbnail(p.url, img, loader).catch(err => {
          console.warn('thumbnail üretilemedi:', err);
          loader.remove();
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23111111"/><text x="50%" y="50%" fill="%23aaa" font-size="20" text-anchor="middle" dy=".3em">No preview</text></svg>';
        });
      } else if (p.type === 'image') {
        img.src = p.url;
        loader.remove();
      } else if (p.type === 'audio') {
        // if audio and no thumbnail, show a default cover / or provided thumbnail
        img.src = p.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23111111"/><text x="50%" y="50%" fill="%23aaa" font-size="20" text-anchor="middle" dy=".3em">Audio</text></svg>';
        loader.remove();
      } else {
        // fallback
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23111111"/><text x="50%" y="50%" fill="%23aaa" font-size="18" text-anchor="middle" dy=".3em">No preview</text></svg>';
        loader.remove();
      }

      // tıklanınca modal aç / oynat
      card.addEventListener('click', async (ev) => {
        ev.preventDefault();
        openModal(p);
      });
    });
  }

  // modal back
  modalBack.addEventListener('click', closeModal);

  // ESC ile kapatma
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  function openModal(project) {
    modalBody.innerHTML = ''; // temizle
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');

    if (project.type === 'video') {
      const video = document.createElement('video');
      video.src = project.url;
      video.controls = true;
      video.setAttribute('playsinline','');
      video.style.background = '#000';
      // user clicked -> play allowed
      setTimeout(()=> {
        // try play; if browser blocks autoplay with sound, user can press play
        video.play().catch(()=>{ /* ignore */ });
      }, 50);
      modalBody.appendChild(video);
    } else if (project.type === 'audio') {
      const audio = document.createElement('audio');
      audio.src = project.url;
      audio.controls = true;
      modalBody.appendChild(audio);
      setTimeout(()=> audio.play().catch(()=>{}), 50);
    } else if (project.type === 'image') {
      const img = document.createElement('img');
      img.src = project.url;
      img.alt = project.title || '';
      modalBody.appendChild(img);
    } else {
      modalBody.innerHTML = '<p class="muted">Bu proje tipi şu an desteklenmiyor.</p>';
    }
  }

  function closeModal() {
    // pause any media
    const media = modalBody.querySelector('video, audio');
    if(media) {
      try { media.pause(); media.currentTime = 0; } catch(e){}
    }
    modalBody.innerHTML = '';
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }

  // helper: html escape
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // thumbnail üretimi: video element kullanarak rastgele bir frame alır
  async function generateVideoThumbnail(videoUrl, imgElement, loaderEl){
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = videoUrl;

      // bazı tarayıcılarda crossOrigin gerekebilir; videon aynı origin'deyse gerek yok
      let got = false;
      const cleanup = () => {
        try { video.pause(); video.src = ''; } catch(e){}
        video.remove();
      };

      const timeoutId = setTimeout(() => {
        if(!got){
          cleanup();
          reject(new Error('thumbnail-timeout'));
        }
      }, 9000); // 9s timeout

      video.addEventListener('loadedmetadata', () => {
        // video süresinden güvenli bir rastgele zaman seç (baş/son 0.3s atla)
        const dur = video.duration || 1;
        const safeStart = Math.min(0.2, dur*0.01);
        const safeEnd = Math.max(dur - 0.3, safeStart + 0.1);
        const rand = Math.random() * (Math.max(safeEnd - safeStart, 0.1)) + safeStart;
        // seek
        const onSeeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const w = video.videoWidth || 640;
            const h = video.videoHeight || 360;
            // küçük thumbnail boyutu için oranlı küçültme (ör: width=480 max)
            const maxW = 480;
            let targetW = Math.min(w, maxW);
            let targetH = Math.floor(targetW * (h / w));
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, targetW, targetH);
            // kalite dengesi
            const data = canvas.toDataURL('image/jpeg', 0.7);
            imgElement.src = data;
            got = true;
            clearTimeout(timeoutId);
            loaderEl.remove();
            cleanup();
            resolve(data);
          } catch (err) {
            clearTimeout(timeoutId);
            loaderEl.remove();
            cleanup();
            reject(err);
          }
        };

        // attach one-time seeked handler
        video.currentTime = Math.max(0, Math.min(rand, dur - 0.05));
        video.addEventListener('seeked', onSeeked, { once: true });
      });

      // hata yakalama
      video.addEventListener('error', (e) => {
        clearTimeout(timeoutId);
        loaderEl.remove();
        cleanup();
        reject(new Error('video-load-error'));
      });
    });
  }
});
