

import { createSocket } from './socket.js';


const $ = (x) => document.querySelector(x);
const esc = (x) => {
  const txt = document.createTextNode(x);
  const p = document.createElement('p');
  p.appendChild(txt);
  return p.innerHTML;
};

const ws = await createSocket();
const debounceTime = 1000;
let base = Math.floor(Math.random() * 50 + 30);
const noise = Math.floor(Math.random() * 10 - 5);

if (!sessionStorage.getItem('peopleOnline')) {
  sessionStorage.setItem('peopleOnline', base);
} else {
  base = +sessionStorage.getItem('peopleOnline');
}

let timeout;
let searchTimeout; // Timeout for searching
let isConnected = false; // Track if a connection is established
let isSearching = false; 
let isConfirmingSkip = false;

const $peopleOnline = $('#peopleOnline p span');
const $skipBtn = $('#skip-btn');
const $sendBtn = $('#send-btn');
const $msgs = $('#messages');
const $msgArea = $('#message-area');
const $typing = $('#typing');
const $input = $('#message-input');






function configureChat() {
  $input.focus();

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $skipBtn.click();
      e.preventDefault();
    }
  });



  

  $input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearInterval(timeout);
      ws.emit('typing', false);
      $sendBtn.click();
      return e.preventDefault();
    }
    ws.emit('typing', true);
  });

  $input.addEventListener('keyup', function (e) {
    clearInterval(timeout);
    timeout = setTimeout(() => {
      ws.emit('typing', false);
    }, debounceTime);
  });
}

const initializeConnection = () => {
  if (isConnected) return; 

  isSearching = true;
  isConfirmingSkip = false; 
  $skipBtn.textContent = 'Cancel'; 


  let connectionPaused = false;

  $skipBtn.onclick = () => {
    
    if (isSearching) {
      isConnected = true;
      clearTimeout(searchTimeout); // Clear the search timeout
      isSearching = false;
      connectionPaused = true; // Pause the connection initialization
      ws.emit('disconnect'); 
      const msgE = document.createElement('div');
      msgE.className = 'message-status';
      msgE.innerHTML = 'You have disconnected';
      msgE.style.color = 'red';
      $msgs.appendChild(msgE);
     
     
    
    $skipBtn.textContent = 'New?';
    $skipBtn.onclick = async () => { // Use async here
      

      initializeConnection();
    };
  }
};

  $msgs.innerHTML = `
    <div class="message-status">Looking for people online...</div>
  `;
  $sendBtn.disabled = true;
  $input.value = '';
  $input.readOnly = true;


  ws.emit('peopleOnline');
  const params = new URLSearchParams(window.location.search);
  const interests = params
    .get('interests')
    ?.split(',')
    .filter((x) => !!x)
    .map((x) => x.trim()) || [];
  ws.emit('match', { data: 'text', interests });
};


  searchTimeout = setTimeout(() => {
    if (isSearching) { // Check if the search is still active
      ws.emit('match', { data: 'text', interests });
    }
  }, 0); // Adjust the timeout duration as needed 

$sendBtn.addEventListener('click', () => {
  const msg = $input.value.trim();
  if (!msg) return;

  const msgE = document.createElement('div');
  msgE.className = 'message';
  msgE.innerHTML = `<span class="you">You:</span> ${esc(msg)}`;

  $msgs.appendChild(msgE);
  $msgArea.scrollTop = $msgArea.scrollHeight;
  $input.value = '';

  ws.emit('message', esc(msg));
});

ws.register('peopleOnline', async (data) => {
  $peopleOnline.innerHTML = base + noise + +data;
});

ws.register('connected', async (data) => {
  isSearching = false;
  $skipBtn.textContent = 'Skip'; 
  $skipBtn.onclick = () => {
    if (!isConfirmingSkip) {
      $skipBtn.textContent = 'Cancel?';
      isConfirmingSkip = true;
    } else {
      ws.emit('disconnect');
      initializeConnection();
      isConfirmingSkip = false;
    }
  };

  const params = new URLSearchParams(window.location.search);
  const interests = params
    .get('interests')
    ?.split(',')
    .filter((x) => !!x)
    .map((x) => x.trim()) || [];

  let commonInterests = data.at(-1) || '';
  const first = data.slice(0, -1);
  if (first.length) {
    commonInterests = `${first.join(', ')} and ${commonInterests}`;
  }

  $msgs.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'message-status';
  status.innerHTML = 'You are now talking to a random stranger';
  $msgs.appendChild(status);

  if (commonInterests) {
    const status = document.createElement('div');
    status.className = 'message-status';
    status.innerHTML = `You both like ${esc(commonInterests)}`;
    $msgs.appendChild(status);
  } else if (interests.length) {
    const status = document.createElement('div');
    status.className = 'message-status';
    status.innerHTML =
      "Couldn't find anyone with similar interests, so this stranger is completely random. Try adding more interests!";
    $msgs.appendChild(status);
  }

  $msgArea.scrollTop = $msgArea.scrollHeight;
  $sendBtn.disabled = false;
  $input.readOnly = false;
});

ws.register('message', async (msg) => {
  if (!msg) return;

  const msgE = document.createElement('div');
  msgE.className = 'message';
  msgE.innerHTML = `<span class="strange">Stranger:</span> ${esc(msg)}`;

  $msgs.appendChild(msgE);
  $msgArea.scrollTop = $msgArea.scrollHeight;
});

ws.register('typing', async (isTyping) => {
  $typing.style.display = isTyping ? 'block' : 'none';
  $msgArea.scrollTop = $msgArea.scrollHeight;
});

ws.register('disconnect', async () => {
  console.log('received disconnect request');
  const msgE = document.createElement('div');
  msgE.className = 'message-status';
  msgE.innerHTML = 'Stranger has disconnected';
  msgE.style.color = 'red';
  $msgs.appendChild(msgE);
  $sendBtn.disabled = true;
  $input.value = '';
  $input.readOnly = true;
  
  // Ensure "Stranger is typing" is cleared
  $typing.style.display = 'none'; 

  $skipBtn.textContent = 'New';
  $skipBtn.onclick = initializeConnection; 
});

// Add the new event handler
ws.register('stopped-typing', async () => {
  $typing.style.display = 'none';
  $msgArea.scrollTop = $msgArea.scrollHeight; 
});

configureChat();
initializeConnection();

