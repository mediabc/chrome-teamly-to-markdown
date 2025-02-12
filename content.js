// Функция для отправки состояния в popup
function sendStatus(status) {
  chrome.runtime.sendMessage({ type: 'STATUS', status });
}

function convertToMarkdown() {
  console.log('Starting conversion to Markdown...');
  sendStatus('converting');

  // Log all available elements for debugging
  console.log('All editor elements:', document.querySelectorAll('[class*="editor"]'));
  console.log('All tiptap elements:', document.querySelectorAll('[class*="tiptap"]'));

  // Get the main article content - используем прямой селектор без parent matching
  const article = document.querySelector('.editor__body-content .tiptap.ProseMirror');
  console.log('Article element:', article);
  if (!article) {
    console.error('Article element not found');
    sendStatus('error');
    return null;
  }

  let markdown = '';

  // Get title - исправим селектор заголовка
  const title = document.querySelector('.editor-title__text');
  console.log('Title element:', title);
  if (title) {
    markdown += `# ${title.textContent.trim()}\n\n`;
    console.log('Title text:', title.textContent.trim());
  }

  // Process content
  function processNode(node) {
    console.log('Processing node:', node.nodeName, node);
    
    switch (node.nodeType) {
      case Node.TEXT_NODE:
        return node.textContent;
        
      case Node.ELEMENT_NODE:
        switch (node.tagName.toLowerCase()) {
          case 'h1': 
            return `# ${Array.from(node.childNodes).map(child => processNode(child)).join('')}\n\n`;
          case 'h2': 
            return `## ${Array.from(node.childNodes).map(child => processNode(child)).join('')}\n\n`;
          case 'h3': 
            return `### ${Array.from(node.childNodes).map(child => processNode(child)).join('')}\n\n`;
          case 'p': 
            return `${Array.from(node.childNodes).map(child => processNode(child)).join('')}\n\n`;
          case 'ul':
            return Array.from(node.children)
              .map(li => `* ${Array.from(li.childNodes).map(child => processNode(child)).join('')}\n`)
              .join('') + '\n';
          case 'ol':
            return Array.from(node.children)
              .map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(child => processNode(child)).join('')}\n`)
              .join('') + '\n';
          case 'img':
            return `![${node.alt || ''}](${node.src})\n\n`;
          case 'a':
            // Improved link processing
            const href = node.getAttribute('data-url') || node.href || '';
            const text = Array.from(node.childNodes).map(child => processNode(child)).join('').trim() || '';
            // Handle cases where href might be empty or same as text
            if (!href || href === text) {
              return text;
            }
            // Remove the base URL if it's an internal link
            const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');
            return `[${text}](${cleanHref})`;
          case 'code':
            return `\`${node.textContent}\``;
          case 'pre':
            return `\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
          case 'table':
            return processTable(node) + '\n\n';
          default:
            return Array.from(node.childNodes)
              .map(child => processNode(child))
              .join('');
        }
    }
    return '';
  }

  markdown += processNode(article);
  console.log('Generated Markdown:', markdown);

  // Download the markdown file
  try {
    const blob = new Blob([markdown], { type: 'text/plain' });
    console.log('Created Blob:', blob);

    const url = URL.createObjectURL(blob);
    console.log('Created URL:', url);

    // Новая функция для обработки имени файла
    function sanitizeFilename(name) {
      // Заменяем только действительно недопустимые символы для файловой системы
      return name.replace(/[<>:"/\\|?*]/g, '_') + '.txt';
    }

    const filename = title?.textContent 
      ? sanitizeFilename(title.textContent.trim())
      : 'article.txt';
    console.log('Filename:', filename);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    console.log('Download link created:', a);

    document.body.appendChild(a); // Добавим элемент в DOM для надежности
    console.log('Link added to document');

    a.click();
    console.log('Click initiated');

    document.body.removeChild(a); // Удалим элемент
    URL.revokeObjectURL(url);
    console.log('Cleanup completed');
    sendStatus('complete');
  } catch (error) {
    console.error('Error during download:', error);
    sendStatus('error');
  }
}

// Увеличим задержку до 5 секунд, так как страница может загружаться дольше
console.log('Script loaded, waiting for page...');
sendStatus('waiting');
setTimeout(() => {
  console.log('Attempting to convert after delay...');
  convertToMarkdown();
}, 5000); // 5 second delay

// Удалим лишние обработчики событий, оставим только setTimeout
// так как DOMContentLoaded и load могут сработать раньше, чем загрузится React-приложение 

// Добавляем функцию для обработки таблиц
function processTable(tableNode) {
  const rows = Array.from(tableNode.rows);
  if (rows.length === 0) return '';

  // Функция для очистки и форматирования текста ячейки
  function processCellContent(cell) {
    let content = '';
    
    function extractContent(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case 'a':
            const href = node.href || '';
            const text = node.textContent.trim() || '';
            // Handle cases where href might be empty or same as text
            if (!href || href === text) {
              return text;
            }
            // Remove the base URL if it's an internal link
            const cleanHref = href.replace(/^https?:\/\/[^\/]+/, '');
            return `[${text}](${cleanHref})`;
          case 'strong':
          case 'b':
            return `**${node.textContent.trim()}**`;
          case 'p':
            return node.textContent.trim() + ' ';
          default:
            return Array.from(node.childNodes)
              .map(child => extractContent(child))
              .join('');
        }
      }
      return '';
    }
    
    content = extractContent(cell);
    
    // Очищаем лишние пробелы и экранируем символы
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ');
  }

  // Получаем заголовки
  const headers = Array.from(rows[0].cells).map(cell => processCellContent(cell));
  
  // Создаем строку заголовков
  let markdown = '| ' + headers.join(' | ') + ' |\n';
  
  // Добавляем разделительную строку
  markdown += '|' + headers.map(() => ' --- ').join('|') + '|\n';
  
  // Добавляем данные
  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].cells).map(cell => processCellContent(cell));
    markdown += '| ' + cells.join(' | ') + ' |\n';
  }
  
  return markdown;
} 