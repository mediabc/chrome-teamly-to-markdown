// Функция для управления состоянием кнопки
function setButtonState(loading) {
  const button = document.getElementById('downloadBtn');
  button.disabled = loading;
  if (loading) {
    button.classList.add('loading');
  } else {
    button.classList.remove('loading');
  }
}

// Слушаем сообщения от content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATUS') {
    switch (message.status) {
      case 'waiting':
      case 'converting':
        setButtonState(true);
        break;
      case 'complete':
      case 'error':
        setButtonState(false);
        break;
    }
  }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const button = document.getElementById('downloadBtn');
  
  // Prevent double clicks
  if (button.disabled) return;
  
  // Set loading state
  setButtonState(true);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes('teamly.ru')) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } else {
      alert('Пожалуйста, перейдите сначала на страницу статьи Teamly');
      setButtonState(false);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Произошла ошибка при скачивании статьи');
    setButtonState(false);
  }
}); 