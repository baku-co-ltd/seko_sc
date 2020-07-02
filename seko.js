// オンライブ一覧を取得する
function getOnlives(){
  var rooms = sessionStorage.getItem("rooms")
  if(rooms && rooms.length >= 10){
    return JSON.parse(rooms);
  }
  var rooms = [[],[]];
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      console.log("getOnlives:" + xhr.status);
      if (xhr.status == 200) {
        var json = JSON.parse(xhr.responseText);
        for(i=0; i<json.onlives.length; i++){
          var genre = json.onlives[i]
          for(j=0; j<genre.lives.length; j++){
            if(genre.lives[j].room_url_key){
              rooms[genre.lives[j].official_lv].push({
                // "url_key": genre.lives[j].room_url_key,
                "room_id": genre.lives[j].room_id,
                // "live_id": genre.lives[j].live_id,
              });
            }
          }
        }
      }
    }
  }
  xhr.open("GET","https://www.showroom-live.com/api/live/onlives", false);
  xhr.send();
  sessionStorage.setItem("rooms",JSON.stringify(rooms));
  return rooms;
}

function getRoomId(level){
  var rooms = getOnlives();
  var room = rooms[level].pop();
  sessionStorage.setItem("rooms", JSON.stringify(rooms));
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
              document.getElementById("seko_star_count").innerText = count;
            }else{
              document.getElementById("seko_seed_count").innerText = count;
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
      document.getElementById("seko_comment").innerText = "完了";
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        // clearInterval(interval);
        console.log("polling:" + xhr.status);
        if (xhr.status == 200) {
          var json = JSON.parse(xhr.responseText);
          if(json.live_watch_incentive){
            // 成功
            if(json.live_watch_incentive.ok){
              // アイテム取得
              console.log("polling:get");
              document.getElementById("seko_comment").innerText = "GET！";
              // 次の回収
              polling(level, getRoomId(level), true);
            }else if(json.live_watch_incentive.error == 1){
              // 制限されています
              console.log("polling:limit");
              document.getElementById("seko_comment").innerText = "制限中";
            }else{
              if(first){
                // 初回トライ
                console.log("polling:try");
                document.getElementById("seko_comment").innerText = "回収中";
                // 30秒後にもう一度叩く
                setTimeout(function(){
                  polling(level, room_id, false);
                }, 30000);
              }else{
                // ２回目トライ
                console.log("polling:error");
                document.getElementById("seko_comment").innerText = "失敗！";
                polling(level, getRoomId(level), true);
              }
            }
          }
        } else {
          document.getElementById("seko_comment").innerText = "失敗！";
          polling(level, getRoomId(level), true);
        }
      }
    }
    xhr.open("GET","https://www.showroom-live.com/api/live/polling?room_id="+room_id, false);
    xhr.send();
  }
