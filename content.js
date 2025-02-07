function convertToMarkdown() {
  console.log('Starting conversion to Markdown...');

  // Log all available elements for debugging
  console.log('All editor elements:', document.querySelectorAll('[class*="editor"]'));
  console.log('All tiptap elements:', document.querySelectorAll('[class*="tiptap"]'));
  console.log('Full HTML:', document.documentElement.innerHTML);

  // Get the main article content - используем прямой селектор без parent matching
  const article = document.querySelector('.tiptap.ProseMirror');
  console.log('Article element:', article);
  if (!article) {
    console.error('Article element not found');
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
          case 'h1': return `# ${node.textContent}\n\n`;
          case 'h2': return `## ${node.textContent}\n\n`;
          case 'h3': return `### ${node.textContent}\n\n`;
          case 'p': return `${node.textContent}\n\n`;
          case 'ul':
            return Array.from(node.children)
              .map(li => `* ${li.textContent}\n`)
              .join('') + '\n';
          case 'ol':
            return Array.from(node.children)
              .map((li, i) => `${i + 1}. ${li.textContent}\n`)
              .join('') + '\n';
          case 'img':
            return `![${node.alt || ''}](${node.src})\n\n`;
          case 'a':
            return `[${node.textContent}](${node.href})`;
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
  } catch (error) {
    console.error('Error during download:', error);
  }
}

// Увеличим задержку до 5 секунд, так как страница может загружаться дольше
console.log('Script loaded, waiting for page...');
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
    // Собираем весь текстовый контент, включая ссылки
    let content = '';
    
    function extractContent(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case 'a':
            // Сохраняем ссылки в markdown формате
            return `[${node.textContent.trim()}](${node.href})`;
          case 'strong':
          case 'b':
            return `**${node.textContent.trim()}**`;
          case 'p':
            // Объединяем параграфы пробелом вместо переноса строки
            return node.textContent.trim() + ' ';
          default:
            // Рекурсивно обрабатываем вложенные элементы
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