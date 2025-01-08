import puppeteer from 'puppeteer';

(async () => {
  console.log('📦 Baixando Chromium...');
  try {
    const browserFetcher = puppeteer.createBrowserFetcher();
    const revisionInfo = await browserFetcher.download('1095492'); // Versão estável
    console.log('✅ Chromium baixado com sucesso em:', revisionInfo.folderPath);
  } catch (error) {
    console.error('❌ Erro ao baixar o Chromium:', error);
  }
})();
