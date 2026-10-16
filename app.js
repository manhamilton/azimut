/* Azimut Utara Web App
 * Spreadsheet reference: AZIMUT UTARA EXP.xlsx
 * North azimuth follows the spreadsheet's EoT/de declination/hour-angle approximation.
 * Qibla bearing uses atan2 for correct quadrant handling.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const K = {lon:39 + 49/60 + 34.18/3600, lat:21 + 25/60 + 21/3600};
  let current = null, map = null, marker = null, line = null, orientation = 0, deferredInstall = null;
  const HIST_KEY = "azimut-utara-history-v1";
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const norm = d => ((d % 360) + 360) % 360;
  const fmt = (n, digits=6) => Number(n).toFixed(digits);
  const dms = d => {
    const v = norm(d), D = Math.floor(v), mf = (v-D)*60, M = Math.floor(mf), S = Math.round((mf-M)*60);
    if (S === 60) return `${D}° ${M+1}′ 00″`;
    return `${D}° ${M}′ ${String(S).padStart(2,"0")}″`;
  };
  function inputData() {
    const date = $("date").value, time = $("time").value;
    const [year,month,day] = date.split("-").map(Number);
    const [hour,minute,second=0] = time.split(":").map(Number);
    const lat = Number($("lat").value), lon = Number($("lon").value), zone = Number($("zone").value);
    if (!date || !time || ![year,month,day,hour,minute,second,lat,lon,zone].every(Number.isFinite)) throw Error("Lengkapi semua data yang wajib diisi.");
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || zone < -12 || zone > 14) throw Error("Koordinat atau zona waktu berada di luar rentang.");
    return {date,time,year,month,day,hour,minute,second,lat,lon,zone,place:$("place").value.trim()};
  }
  function calculate(d) {
    // JD from the workbook (local time corrected by zone and equation of time).
    let m2=d.month, y2=d.year;
    if(m2<3){m2+=12;y2-=1;}
    const datePlus=d.day+((d.hour-d.zone)+d.minute/60+d.second/3600)/24;
    const A=Math.trunc(y2/100), B=2+Math.trunc(A/4)-A;
    const jd=1720994.5+Math.trunc(365.25*y2)+Math.trunc(30.6001*(m2+1))+B+datePlus;
    const U=(jd-2451545)/36525;
    const LO=norm(280.46607+36000.7968*U);
    const eot=(-(1789+237*U)*Math.sin(rad(LO))-(7146-62*U)*Math.cos(rad(LO))+(9934-14*U)*Math.sin(rad(2*LO))-(29+5*U)*Math.cos(rad(2*LO))+(74+10*U)*Math.sin(rad(3*LO))+(320-4*U)*Math.cos(rad(3*LO))-212*Math.sin(rad(4*LO)))/1000/60;
    const T=2*Math.PI*(jd-2451545)/365.25;
    const decl=0.37877+23.264*Math.sin(rad(57.297*T-79.547))+0.3812*Math.sin(rad(2*57.297*T-82.682))+0.17132*Math.sin(rad(3*57.297*T-59.722));
    const localTime=d.hour+d.minute/60+d.second/3600;
    const meridians=12-eot;
    const hourAngle=((localTime-meridians)*15+d.lon-(15*d.zone));
    // Reproduce workbook's cotangent method and branch selection, with singularity guard.
    const p=rad(d.lat), D=rad(decl), t=rad(hourAngle);
    const sinT=Math.sin(t), tanT=Math.tan(t);
    const cotA=(Math.cos(p)*Math.tan(D)/sinT)-(Math.sin(p)/tanT);
    let north;
    if(Math.abs(sinT)<1e-12 || !Number.isFinite(cotA) || Math.abs(cotA)<1e-12) {
      // Robust solar azimuth fallback: azimuth measured clockwise from true north.
      const east=-Math.cos(D)*Math.sin(t);
      const northComp=Math.sin(D)*Math.cos(p)-Math.cos(D)*Math.cos(t)*Math.sin(p);
      north=norm(deg(Math.atan2(east,northComp)));
    } else {
      const delta=Math.abs(deg(Math.atan(1/cotA)));
      const positive=localTime<12 ? 360-delta : delta;
      const negative=localTime<12 ? 180+delta : 180-delta;
      north=decl>0 ? positive : negative;
    }
    // Great-circle initial bearing to Ka'bah, atan2 ensures correct quadrant.
    const deltaLon=rad(K.lon-d.lon), lat=rad(d.lat), latK=rad(K.lat);
    const qibla=norm(deg(Math.atan2(Math.sin(deltaLon),Math.cos(lat)*Math.tan(latK)-Math.sin(lat)*Math.cos(deltaLon))));
    const out={...d,jd,eot,decl,hourAngle,north,qibla,computedAt:new Date().toISOString()};
    return out;
  }
  function render(r) {
    $("qiblaDeg").textContent=fmt(r.qibla,4)+"°";
    $("qiblaDms").textContent=dms(r.qibla);
    $("northDeg").textContent=fmt(r.north,4)+"°";
    $("northDms").textContent=dms(r.north);
    $("jd").textContent=fmt(r.jd,6);
    $("eot").textContent=`${r.eot>=0?"+":""}${fmt(r.eot,4)} menit`;
    $("decl").textContent=`${r.decl>=0?"+":""}${fmt(r.decl,5)}°`;
    $("hourAngle").textContent=`${r.hourAngle>=0?"+":""}${fmt(r.hourAngle,5)}°`;
    $("compassAngle").textContent=fmt(r.qibla,2)+"°";
    $("needle").style.transform=`translate(-50%,-50%) rotate(${r.qibla}deg)`;
    $("status").textContent=`Perhitungan selesai untuk ${r.place || `${fmt(r.lat,4)}, ${fmt(r.lon,4)}`}.`;
    updateMap(r);
  }
  function compute(showStatus=true) {
    try { current=calculate(inputData()); render(current); if(showStatus) $("status").textContent="Perhitungan berhasil. Periksa hasil dan simpan bila diperlukan."; return true; }
    catch(e) { $("status").textContent=e.message || "Data belum valid."; return false; }
  }
  function readHistory(){try{return JSON.parse(localStorage.getItem(HIST_KEY)||"[]")}catch{return []}}
  function writeHistory(items){localStorage.setItem(HIST_KEY,JSON.stringify(items));renderHistory()}
  function saveHistory(){
    if(!current && !compute(false)) return;
    const items=readHistory(); items.unshift({...current, savedAt:new Date().toISOString()});
    writeHistory(items.slice(0,100)); $("status").textContent="Hasil disimpan di riwayat perangkat ini.";
  }
  function renderHistory(){
    const items=readHistory(), root=$("historyList"); root.innerHTML="";
    if(!items.length){root.innerHTML='<div class="empty">Belum ada riwayat. Simpan hasil dari tab Kalkulator.</div>';return;}
    items.forEach((x,i)=>{
      const item=document.createElement("div"); item.className="history-item";
      const left=document.createElement("div"), right=document.createElement("div");
      const strong=document.createElement("strong"); strong.textContent=x.place||`${Number(x.lat).toFixed(4)}, ${Number(x.lon).toFixed(4)}`;
      const small=document.createElement("small"); small.textContent=`${x.date} ${x.time} · ${new Date(x.savedAt||x.computedAt).toLocaleString("id-ID")}`;
      left.append(strong,small);
      const value=document.createElement("div"); value.className="history-value"; value.textContent=`Kiblat ${Number(x.qibla).toFixed(2)}°`;
      const load=document.createElement("button"); load.className="ghost small"; load.textContent="Muat"; load.onclick=()=>{["date","time","zone","lat","lon","place"].forEach(k=>$(k).value=x[k]??""); activateTab("calc");compute();};
      right.append(value,load);item.append(left,right);root.append(item);
    });
  }
  function download(name,content,type){
    const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvFor(items){
    const cols=["place","date","time","zone","lat","lon","jd","eot","decl","hourAngle","north","qibla","computedAt","savedAt"];
    const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    return [cols.join(","),...items.map(x=>cols.map(c=>esc(x[c])).join(","))].join("\r\n");
  }
  function exportCurrent(type){
    if(!current && !compute(false))return;
    const filename=`azimut-${current.date}-${current.time.replaceAll(":","-")}`;
    if(type==="csv")download(filename+".csv",csvFor([current]),"text/csv;charset=utf-8");
    else download(filename+".json",JSON.stringify({...current,formulaNotes:{north:"Spreadsheet approximation; see README.",qibla:"Great-circle initial bearing via atan2."}},null,2),"application/json");
  }
  function activateTab(id){
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!==id));
    if(id==="map" && current) setTimeout(()=>{initMap();map&&map.invalidateSize();updateMap(current)},100);
  }
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab)));
  let isCalculating = false;
  $("calcForm").addEventListener("submit",e=>{
    e.preventDefault();
    if(isCalculating)return;
    isCalculating = true;
    const submitButton = $("calcForm").querySelector('button[type="submit"]');
    const overlay = $("loadingOverlay");
    submitButton.disabled = true;
    overlay.classList.remove("hidden");
    // A brief visual pause lets the loading state be seen before rendering results.
    window.setTimeout(()=>{
      try { compute(); }
      finally {
        overlay.classList.add("hidden");
        submitButton.disabled = false;
        isCalculating = false;
      }
    }, 650);
  });
  $("nowBtn").addEventListener("click",()=>{
    const now=new Date();
    const pad=n=>String(n).padStart(2,"0");
    $("date").value=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    $("time").value=`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    // JavaScript's getTimezoneOffset has the opposite sign of UTC offset.
    $("zone").value=String(-now.getTimezoneOffset()/60);
    compute(false);
    if(current) $("status").textContent=`Waktu perangkat diterapkan: ${$("date").value} ${$("time").value} (UTC${Number($("zone").value)>=0?"+":""}${$("zone").value}). Hasil sudah diperbarui.`;
  });
  $("saveBtn").addEventListener("click",saveHistory);
  $("csvBtn").addEventListener("click",()=>exportCurrent("csv"));
  $("jsonBtn").addEventListener("click",()=>exportCurrent("json"));
  $("printBtn").addEventListener("click",()=>window.print());
  $("clearHistory").addEventListener("click",()=>{if(confirm("Hapus semua riwayat di browser ini?"))writeHistory([])});
  $("historyCsvBtn").addEventListener("click",()=>{const h=readHistory();if(h.length)download("riwayat-azimut.csv",csvFor(h),"text/csv;charset=utf-8");else alert("Riwayat masih kosong.")});
  $("gpsBtn").addEventListener("click",()=>{
    if(!navigator.geolocation){$("status").textContent="Browser ini tidak menyediakan GPS.";return;}
    $("gpsBtn").disabled=true;$("gpsBtn").textContent="Mencari lokasi…";
    navigator.geolocation.getCurrentPosition(pos=>{$("lat").value=pos.coords.latitude.toFixed(6);$("lon").value=pos.coords.longitude.toFixed(6);$("gpsBtn").disabled=false;$("gpsBtn").textContent="◎ Gunakan GPS";$("status").textContent=`Lokasi diperoleh (akurasi ±${Math.round(pos.coords.accuracy)} m). Tekan Hitung azimut.`;},err=>{$("gpsBtn").disabled=false;$("gpsBtn").textContent="◎ Gunakan GPS";$("status").textContent="GPS gagal: "+({1:"izin lokasi ditolak",2:"lokasi tidak tersedia",3:"waktu permintaan habis"}[err.code]||err.message)+". Pastikan izin lokasi aktif dan situs memakai HTTPS.";},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
  $("calibrateBtn").addEventListener("click",()=>$("calibration").classList.toggle("hidden"));
  $("sensorBtn").addEventListener("click",async()=>{
    try {
      if(typeof DeviceOrientationEvent==="undefined"){throw Error("Sensor orientasi tidak didukung browser ini.");}
      if(typeof DeviceOrientationEvent.requestPermission==="function"){
        const permission=await DeviceOrientationEvent.requestPermission();if(permission!=="granted")throw Error("Izin sensor ditolak.");
      }
      window.addEventListener("deviceorientationabsolute" in window?"deviceorientationabsolute":"deviceorientation",onOrientation,true);
      $("sensorStatus").textContent="Sensor aktif jika browser mengirim heading. Tetap verifikasi dengan kompas tepercaya.";
    } catch(e){$("sensorStatus").textContent=e.message+" Visual tetap menampilkan azimut numerik dari utara sejati.";}
  });
  function onOrientation(e){
    let heading;
    if(typeof e.webkitCompassHeading==="number")heading=e.webkitCompassHeading;
    else if(typeof e.alpha==="number")heading=360-e.alpha;
    if(Number.isFinite(heading)){orientation=heading; /* no automatic correction: magnetic north vs true north varies */}
  }
  function initMap(){
    if(map || !window.L)return;
    map=L.map("mapCanvas").setView([Number($("lat").value)||-6.88,Number($("lon").value)||107.55],5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  }
  function destinationPoint(lat,lon,bearing,distanceKm){
    const R=6371, δ=distanceKm/R, θ=rad(bearing), φ1=rad(lat), λ1=rad(lon);
    const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
    const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
    return [deg(φ2),((deg(λ2)+540)%360)-180];
  }
  function updateMap(r){
    if(!window.L)return;
    initMap(); if(!map)return;
    const start=[r.lat,r.lon], end=[K.lat,K.lon];
    if(marker)map.removeLayer(marker); if(line)map.removeLayer(line);
    marker=L.marker(start).addTo(map).bindPopup(r.place||"Lokasi pengamatan");
    line=L.polyline([start,end],{color:"#236b62",weight:3,dashArray:"7 7"}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[25,25],maxZoom:8});
  }
  $("openMapBtn").addEventListener("click",()=>{if(current)window.open(`https://www.openstreetmap.org/?mlat=${current.lat}&mlon=${current.lon}#map=12/${current.lat}/${current.lon}`,"_blank","noopener")});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").classList.remove("hidden")});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").classList.add("hidden")});
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  renderHistory();compute(false);
})();