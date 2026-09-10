import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';

const events=['dhs-2026-09-18','mpd-2026-09-19','osse-2026-09-29','dhs-2026-10-02','osse-2026-11-03','dhs-2026-12-08'];
await mkdir('qr-codes',{recursive:true});
for(const id of events){
  const url=`https://kitchen.healthlink360.ai/checkin.html?event=${id}`;
  await QRCode.toFile(`qr-codes/${id}.svg`,url,{type:'svg',errorCorrectionLevel:'H',margin:2,color:{dark:'#17131c',light:'#ffffff'}});
}
