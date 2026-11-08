/* Test-only image functions copied from the fixed 139d0f9 baseline. */
        function downloadImageAsDataUrl(imageUrl) {
            if(/^https:/.test(imageUrl))return wallpaperRequest(imageUrl,'blob').then(function(blob){
                if(!/^image\/(jpeg|png|webp)$/.test(blob.type)||blob.size>10*1024*1024)throw new Error(window.FocusI18n.text('图片格式或大小无效。'));
                var objectUrl=URL.createObjectURL(blob);
                return downloadImageAsDataUrl(objectUrl).finally(function(){URL.revokeObjectURL(objectUrl);});
            });
            return new Promise(function(resolve, reject) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                var timer = setTimeout(function() { img.onload=img.onerror=null;img.src='';reject(new Error(window.FocusI18n.text('图片加载超时'))); }, 20000);
                img.onload = function() {
                    clearTimeout(timer);
                    try {
                        var MAX_W = 1920, MAX_H = 1080;
                        var w = img.naturalWidth, h = img.naturalHeight;
                        if (w > MAX_W || h > MAX_H) {
                            var ratio = Math.min(MAX_W / w, MAX_H / h);
                            w = Math.round(w * ratio);
                            h = Math.round(h * ratio);
                        }
                        var canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch(e) { reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('Canvas处理失败: '):'Canvas处理失败: ') + e.message)); }
                };
                img.onerror = function() {
                    clearTimeout(timer);
                    reject(new Error((typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('图片加载失败，可能存在跨域限制'):'图片加载失败，可能存在跨域限制')));
                };
                img.src = imageUrl;
            });
        }

        // 创建缩略图 240×160
        function createThumbnail(dataUrl) {
            return new Promise(function(resolve) {
                var img = new Image();
                img.onload = function() {
                    var c = document.createElement('canvas');
                    c.width = 240; c.height = 160;
                    c.getContext('2d').drawImage(img, 0, 0, 240, 160);
                    resolve(c.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = function() { resolve(dataUrl); };
                img.src = dataUrl;
            });
        }


export {downloadImageAsDataUrl,createThumbnail};
