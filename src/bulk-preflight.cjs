const ACCOUNT_SELECTOR=['.header-user-button[role="button"]','button[aria-label="Account information"]','button[aria-label="Thông tin về tài khoản"]','button[aria-label*="Google Account"]','a[aria-label*="Google Account"]','button[aria-label*="Tài khoản Google"]'].map(s=>s+':visible').join(', ');
async function readFreshBulkBalance(page,reader,{attempts=3,wait=ms=>new Promise(r=>setTimeout(r,ms)),report=()=>{}}={}){
 report('Đợi giao diện Flow và tài khoản tải xong');
 try{await page.locator(ACCOUNT_SELECTOR).first().waitFor({state:'visible',timeout:30000});}
 catch{throw Error('Flow chưa hiện tài khoản sau khi mở trình duyệt. Kiểm tra đăng nhập ở tab Flow đang mở rồi bấm Tiếp tục lô.');}
 let error;
 for(let attempt=1;attempt<=attempts;attempt++){
  report(`Đọc số dư Flow trực tiếp · lần ${attempt}/${attempts}`);
  try{const amount=await reader(page);if(!Number.isFinite(amount)||amount<0)throw Error('Số dư không hợp lệ.');return amount;}
  catch(e){error=e;if(attempt<attempts){await page.keyboard.press('Escape').catch(()=>{});await wait(750);}}
 }
 throw Error('Không đọc được số dư mới sau khi Flow đã tải và thử lại '+attempts+' lần. Giữ tab Flow đang mở để kiểm tra đăng nhập, rồi bấm Tiếp tục lô. Chi tiết: '+error.message);
}
module.exports={readFreshBulkBalance,ACCOUNT_SELECTOR};
