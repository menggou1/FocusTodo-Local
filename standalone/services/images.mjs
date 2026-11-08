import { invariant } from './errors.mjs';
/** Browser adapter; the service itself never reaches into document or Image. */
export function createImageConverter({ createImage, createCanvas, createObjectURL, revokeObjectURL, setTimeout: schedule, clearTimeout: cancel }) {
    return (blob, options = {}) => new Promise((resolve, reject) => {
        const url = createObjectURL(blob), image = createImage(); let handle, thumbnailImage;
        const finish = () => { cancel(handle); image.onload = image.onerror = null;
            if(thumbnailImage)thumbnailImage.onload=thumbnailImage.onerror=null;revokeObjectURL(url); };
        handle = schedule(() => { finish(); image.src = ''; reject(new Error('Image decoding timed out')); }, 20000);
        image.onload = async () => {
            try {
                let width = image.naturalWidth, height = image.naturalHeight;
                invariant(width > 0 && height > 0, 'Invalid image dimensions');
                const scale = Math.min(1, 1920 / width, 1080 / height); width = Math.round(width * scale); height = Math.round(height * scale);
                const canvas = createCanvas(); canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(image, 0, 0, width, height); const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                let thumbnailSource=image;
                if(options.thumbnailFromCompressed){
                    thumbnailImage=createImage();
                    thumbnailSource=await new Promise((done,fail)=>{thumbnailImage.onload=()=>done(thumbnailImage);thumbnailImage.onerror=()=>fail(new Error('Thumbnail decoding failed'));thumbnailImage.src=dataUrl;});
                }
                canvas.width = 240; canvas.height = 160; canvas.getContext('2d').drawImage(thumbnailSource, 0, 0, 240, 160);
                const thumbnail = canvas.toDataURL('image/jpeg', 0.8); finish(); resolve({ dataUrl, thumbnail });
            } catch (error) { finish(); reject(error); }
        };
        image.onerror = () => { finish(); reject(new Error('Image decoding failed')); }; image.src = url;
    });
}
