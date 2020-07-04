var sekoStore = {
  dt: Date.now(),
  is_flesh: function(now){
    return now - this.dt < 900000;
  },
  rooms: [[],[]],
}
// オンライブ一覧を取得する
function getOnlives(){
  if(sekoStore.is_flesh(Date.now())){
    if(sekoStore.rooms[0].length > 10 && sekoStore.rooms[0].length > 10){
      return sekoStore.rooms;
    }
  }
  var rooms = [[],[]];
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      console.log("getOnlives:" + xhr.status);
      if (xhr.status == 200) {
        var json = JSON.parse(xhr.responseText);
        for(i=0; i<json.onlives.length; i++){
          var genre = json.onlives[i];
          for(j=0; j<genre.lives.length; j++){
            var started_at = parseInt(genre.lives[j].started_at+"000");
            console.log(started_at);
            // if(Date.now() - started_at < 1800000 ){
              rooms[genre.lives[j].official_lv].push({
                // "url_key": genre.lives[j].room_url_key,
                "room_id": genre.lives[j].room_id,
                "started_at": started_at,
                // "live_id": genre.lives[j].live_id,
              });
            // }
          }
          rooms[0].sort(function(a,b){
            return b.started_at - a.started_at;
          })
        }
      }
    }
  }
  xhr.open("GET","https://www.showroom-live.com/api/live/onlives", false);
  xhr.send();
  sekoStore.rooms = rooms;
  return rooms;
}

// setTimeout(function(){sekoStore.rooms = getOnlives();},0);

function getRoomId(level){
  var rooms = getOnlives();
  var room = rooms[level].pop();
  sekoStore.rooms = rooms;
  return room.room_id;
}

// ギフトの状態を確認する
function giftCheck(level, room_id){
  var GIFT_IDS = [
    [1501, 1502, 1503, 1504, 1505], // 種のID
    [1, 2, 1001, 1002, 1003], // 星のID
  ];
  var count = 0;
  var counts = [];
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(){
    if (xhr.readyState == 4) {
      console.log("giftCheck:"+xhr.status);
      if (xhr.status == 200) {
        var json = JSON.parse(xhr.responseText);
        if(json.gift_list){
          var gifts = json.gift_list.normal
          for(i=0; i<gifts.length; i++){
            for(j=0; j<GIFT_IDS[level].length; j++){
              if(gifts[i].gift_id == GIFT_IDS[level][j]){
                counts.push(gifts[i].free_num);
              }
            }
          }
          if(counts.length){
            count = Math.min.apply(null, counts);
            if(level){
              document.getElementById("seko_star_t").innerText = count;
            }else{
              document.getElementById("seko_seed_t").innerText = count;
            }
          }
        }
      }
    }
  }
  xhr.open("GET", "https://www.showroom-live.com/api/live/current_user?room_id="+room_id, false);
  xhr.send();
  return count;
}

function polling(level, room_id=null, first=true){
  var LIMIT = 99;
  var item_num = 0;
  if(room_id){
    item_num = giftCheck(level, room_id);
  }else{
    room_id = getRoomId(level);
    item_num = giftCheck(level, room_id);
  }
  if(LIMIT <= item_num){
    // 上限値に到達している場合
    console.log("polling:finish");
    seko_ctrl_btn(level, "完了", "seko_success");
    return;
  }
  setTimeout(function(){
    seko_ctrl_btn(level, "回収中", "seko_warning");
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        console.log("polling:" + xhr.status);
        if (xhr.status == 200) {
          var json = JSON.parse(xhr.responseText);
          if(json.live_watch_incentive){
            // 成功
            if(json.live_watch_incentive.ok){
              // アイテム取得
              console.log("polling:get");
              seko_ctrl_btn(level, "GET!", "seko_success");

              // 次の回収
              polling(level, getRoomId(level), true);
            }else if(json.live_watch_incentive.error == 1){
              // 制限されています
              console.log("polling:limit");
              var release = json.live_watch_incentive.message;
              release = release.replace("無料ギフトの獲得は","");
              release = release.replace("まで制限されています","");
              seko_ctrl_btn(level, release, "seko_info");
            }else{
              if(first){
                // 初回トライ
                console.log("polling:try");
                setTimeout(function(){
                  seko_ctrl_btn(level, "回収中", "seko_warning");
                }, 1000);
                // 30秒後にもう一度叩く
                polling(level, room_id, false);
              }else{
                // ２回目トライ
                console.log("polling:error");
                seko_ctrl_btn(level, "失敗", "seko_danger");
                polling(level, getRoomId(level), true);
              }
            }
          }
        } else {
          seko_ctrl_btn(level, "失敗", "seko_warning");
          polling(level, getRoomId(level), true);
        }
      }
    }
    xhr.open("GET","https://www.showroom-live.com/api/live/polling?room_id="+room_id, false);
    xhr.send();
  }, first ? 0 : 30000);
}

function seko_ctrl_btn(level, text, class_name=null){
  var id = level ? "seko_star_c" : "seko_seed_c";
  var target = document.getElementById(id)
  target.innerText = text;
  target.classList.remove("seko_success", "seko_danger", "seko_warning", "seko_info");
  if(class_name){
    target.classList.add(class_name);
  }
}

function seko_comment(word){
  var data = {
    live_id: SrGroval.get("liveId"),
    comment: word,
    is_delay: 0,
    csrf_token: SrGroval.get("csrfToken")
  }
  $.post("https://www.showroom-live.com/api/live/post_live_comment", data, function(data){console.log(data)},"json");
}

function seko_count(){
  document.getElementById("seko_count_btn").classList.add("seko_warning");
  var counter = 1;
  countInterval = setInterval(function(){
    seko_comment(counter);
    document.getElementById("seko_count_btn").innerText = counter;
    counter++;
    if(counter>50){
      document.getElementById("seko_count_btn").disabled = true;
      document.getElementById("seko_count_btn").classList.remove("seko_warning");
      clearInterval(countInterval);
    }
  },2000);
}

function seko_gifting(item, mount){
  var data = {
    num: mount,
    gift_id: item,
    live_id: SrGroval.get("liveId"),
    csrf_token: SrGroval.get("csrfToken")
  }
  $.post("https://www.showroom-live.com/api/live/gifting_free", data, function(data){console.log(data)},"json");
}

function seko_auto_gifting(){
  var mount = 10;
  if(SRApp.store.get("isOfficial")){
    seko_gifting("1", mount);
    seko_gifting("2", mount);
    seko_gifting("1001", mount);
    seko_gifting("1002", mount);
    seko_gifting("1003", mount);
  }else{
    seko_gifting("1501", mount);
    seko_gifting("1502", mount);
    seko_gifting("1503", mount);
    seko_gifting("1504", mount);
    seko_gifting("1505", mount);
  }
}

function seko_roomcheck(){
  $.getJSON(
    "https://www.showroom-live.com/api/live/live_info",
    {room_id: SrGloval.room_id},
    function(data){console.log(data)},
  );
}

var seko_style = document.createElement("style");
seko_style.innerHTML = `
  .seko_top {
    position: absolute;
    height: 70px;
    width: 100%;
    top: 0;
    left: 0;
    background-color: #37474F;
    z-index: 1000;
  }
  .seko_beaver {
    position: absolute;
    top: 10px;
    left: 20px;
  }
  .seko_msg {
    position:absolute;
    top: 20px;
    left: 90px;
    width: calc(100% - 110px);
    font-size: 20px;
    font-weight: 700;
    color: #ECEFF1;
  }
  .seko_main {
    position: absolute;
    height: 70px;
    width: 100%;
    top: 450px;
    left: 0;
    background-color: #37474F;
    z-index: 1000;
  }
  .seko_btn {
    position: absolute;
    height: 50px;
    top: 10px;
    padding: 0px;
    border: 0;
    font-weight: 700;
  }
  .seko_btn_c {
    width: 65px;
    padding-left: 35px;
    background-color: #1DE9B6;
    color: #FFFFFF;
    border-radius: 5px 0px 0px 5px;
  }
  .seko_btn_t {
    width: 50px;
    background-color: #ECEFF1;
    color: #37474F;
    border-radius: 0px 5px 5px 0px;
  }
  .seko_star_c {
    left: 5px;
    background-image: url("https://image.showroom-cdn.com/showroom-prod/assets/img/gift/1_s.png");
    background-size: 30px 30px;
    background-position: 5px 10px;
    background-repeat: no-repeat;
  }
  .seko_star_t {
    left: 105px;
  }
  .seko_seed_c {
    left: 160px;
    background-image: url("https://image.showroom-cdn.com/showroom-prod/assets/img/gift/1501_s.png");
    background-size: 30px 30px;
    background-position: 5px 10px;
    background-repeat: no-repeat;
  }
  .seko_seed_t {
    left: 260px;
  }
  .seko_count_btn {
    right: 5px;
    border-radius: 25px;
  }
  .seko_warning {
    background-color: #f39800;
  }
  .seko_danger {
    background-color: #e15929;
  }
  .seko_success {
    background-color: #3bddb5;
  }
  .seko_info {
    background-color: #b4b4b4;
    color: #37474F;
  }
`;
document.body.appendChild(seko_style);

//top
var seko_top = document.createElement("div");
seko_top.classList.add("seko_top");

//logo
var seko_beaver = document.createElement("img");
seko_beaver.src = "https://image.showroom-cdn.com/showroom-prod/image/avatar/1017753.png";
seko_beaver.width = "50";
seko_beaver.classList.add("seko_beaver");
seko_top.appendChild(seko_beaver);
//msg
var seko_msg = document.createElement("div");
seko_msg.id = "seko_msg";
seko_msg.innerText = "せこせこツール for Safari";
seko_msg.classList.add("seko_msg");

seko_top.appendChild(seko_msg);
document.body.appendChild(seko_top);


//main
var seko_main = document.createElement("div");
seko_main.classList.add("seko_main");

//星回収
var seko_star_c = document.createElement("button");
seko_star_c.id = "seko_star_c";
seko_star_c.innerText = "回収";
seko_star_c.onclick = function(){polling(1);};
seko_star_c.classList = ["seko_btn seko_btn_c seko_star_c"];
seko_main.appendChild(seko_star_c);
//星投げ
var seko_star_t = document.createElement("button");
seko_star_t.id = "seko_star_t";
seko_star_t.innerText = " - ";
// seko_star_t.onclick = function(){seko_auto_gifting();};
seko_star_t.classList = ["seko_btn seko_btn_t seko_star_t"];
// seko_star_t.disabled = !(SRApp.store.get("isOfficial"));
seko_main.appendChild(seko_star_t);
//種回収
var seko_seed_c = document.createElement("button");
seko_seed_c.id = "seko_seed_c";
seko_seed_c.innerText = "回収";
seko_seed_c.onclick = function(){polling(0);};
seko_seed_c.classList = ["seko_btn seko_btn_c seko_seed_c"];
seko_main.appendChild(seko_seed_c);
//種投げ
var seko_seed_t = document.createElement("button");
seko_seed_t.id = "seko_seed_t";
seko_seed_t.innerText = " - ";
// seko_seed_t.onclick = function(){seko_auto_gifting();};
seko_seed_t.classList = ["seko_btn seko_btn_t seko_seed_t"];
seko_main.appendChild(seko_seed_t);
//種投げ
var seko_count_btn = document.createElement("button");
seko_count_btn.id = "seko_count_btn";
seko_count_btn.innerText = " C ";
// seko_count_btn.onclick = function(){seko_count();};
seko_count_btn.classList = ["seko_btn seko_btn_t seko_count_btn"];
// seko_star_t.disabled = SRApp.store.get("isOfficial");
seko_main.appendChild(seko_count_btn);

document.body.appendChild(seko_main);

//completion(0);
