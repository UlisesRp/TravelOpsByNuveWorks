/* Compartir recibos: PDF real local; Web Share Files en dispositivos compatibles.
   Sin backend, WhatsApp Web/correo en escritorio no permiten adjuntar archivos de forma automática. */
let receiptPdfLibraryPromise;
function loadReceiptPdfLibrary(){
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!receiptPdfLibraryPromise) receiptPdfLibraryPromise=new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    el.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error('No se cargó la biblioteca PDF'));
    el.onerror=()=>reject(new Error('No se pudo descargar la biblioteca PDF. Revisa tu conexión'));
    document.head.appendChild(el);
  }).catch(e=>{receiptPdfLibraryPromise=null;throw e;});
  return receiptPdfLibraryPromise;
}
async function receiptLogoData(brand){
  const src=brand==='pink'?'assets/pink-logo.png':'assets/velora-logo.png';
  try{const resp=await fetch(src);if(!resp.ok)throw Error('logo');const blob=await resp.blob();return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob);});}catch{return null;}
}
async function createTravelReceiptPDF(r){
  try{
    const PDF=await loadReceiptPdfLibrary();
    const pdf=new PDF({unit:'mm',format:'a4'}), dark=[29,38,56],accent=r.brand==='pink'?[98,35,112]:[29,83,70];
    const text=(str,x,y,size=11,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(...dark);pdf.text(String(str??'—'),x,y);};
    const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
    pdf.setFillColor(...accent);pdf.rect(0,0,210,7,'F');
    const logo=await receiptLogoData(r.brand);
    if(logo){try{pdf.addImage(logo,'PNG',17,15,30,25,undefined,'FAST');}catch{}}
    text(r.brand==='pink'?'Pink Sky Travel':'Velora Travel',52,26,17,true);
    text('RECIBO DE PAGO',17,53,20,true);
    text('Folio: '+r.folio,17,63,11);
    pdf.setDrawColor(225,228,233);pdf.line(17,69,193,69);
    const field=(title,value,y)=>{text(title,17,y,9,true);const lines=pdf.splitTextToSize(String(value??'—'),118);text(lines.join('\n'),72,y,11);};
    field('Cliente / agencia',r.customer,81);
    field('Destino',r.destination,94);
    field('Concepto',r.concept,107);
    field('Fecha de pago',r.paidOn,120);
    field('Método',r.method||'No indicado',133);
    field('Referencia',r.reference||'—',146);
    pdf.setFillColor(247,248,251);pdf.roundedRect(16,159,178,59,4,4,'F');
    text('Total del servicio',23,171,10);text(money(r.total),130,171,12,true);
    text('Pago recibido',23,184,11,true);text(money(r.amount),130,184,14,true);
    text('Pagado acumulado',23,198,10);text(money(r.paid),130,198,11,true);
    text('Saldo pendiente',23,211,10,true);text(money(Math.max(0,r.total-r.paid)),130,211,12,true);
    if(r.notes){text('Notas:',17,233,10,true);const lines=pdf.splitTextToSize(String(r.notes),175).slice(0,3);text(lines.join('\n'),17,240,10);}
    pdf.setFontSize(9);pdf.setTextColor(99,109,123);pdf.text('Comprobante de control de pagos. No sustituye un CFDI.',17,279);
    const filename=String(r.folio||'recibo').replace(/[^a-z0-9_-]/gi,'_')+'.pdf';
    return new File([pdf.output('blob')],filename,{type:'application/pdf'});
  }catch(err){alert('No se pudo generar el PDF: '+err.message+'\nPuedes usar el botón Imprimir / PDF mientras tanto.');return null;}
}
function saveTravelReceipt(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function shareTravelReceiptFile(file,message,channel='whatsapp'){
  if(navigator.share && navigator.canShare?.({files:[file]})){
    try {await navigator.share({files:[file],title:'Recibo de pago',text:message});return;}
    catch(err){if(err.name==='AbortError')return;console.warn('Compartir archivo falló',err);}
  }
  saveTravelReceipt(file);
  if(channel==='email'){
    location.href='mailto:?subject='+encodeURIComponent('Recibo de pago '+file.name.replace('.pdf',''))+'&body='+encodeURIComponent(message+'\n\nAdjunto el recibo PDF.');
  }else{
    window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
  }
  alert('El PDF se descargó como '+file.name+'. Adjunta ese archivo en la conversación antes de enviar.');
}
