// backend/services/webScraperService.js
// Web Scraping Service for Knowledge Base

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Scrape a website and extract all text content
 */
async function scrapeWebsite(websiteUrl) {
    try {
        console.log(`🕷️ Starting scrape of: ${websiteUrl}`);

        const visitedUrls = new Set();
        const scrapedPages = [];
        const baseUrl = new URL(websiteUrl);
        const baseDomain = baseUrl.origin;

        // Start with the homepage
        await crawlPage(websiteUrl, baseDomain, visitedUrls, scrapedPages, 0, 10); // Max 10 pages

        console.log(`✅ Scraped ${scrapedPages.length} pages from ${websiteUrl}`);

        return {
            success: true,
            url: websiteUrl,
            pages: scrapedPages,
            totalPages: scrapedPages.length
        };

    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        return {
            success: false,
            error: error.message,
            pages: []
        };
    }
}

/**
 * Clean URL by removing fragments and trailing slashes
 */
function cleanUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove fragment (everything after #)
        urlObj.hash = '';
        // Remove trailing slash
        let cleanedUrl = urlObj.href;
        if (cleanedUrl.endsWith('/')) {
            cleanedUrl = cleanedUrl.slice(0, -1);
        }
        return cleanedUrl;
    } catch (e) {
        return url;
    }
}

/**
 * Recursively crawl pages
 */
async function crawlPage(url, baseDomain, visitedUrls, scrapedPages, depth, maxDepth) {
    // Clean URL to avoid duplicates
    const cleanedUrl = cleanUrl(url);

    // Stop if we've reached max pages (absolute limit) or max depth or visited this URL
    if (scrapedPages.length >= 10 || depth >= maxDepth || visitedUrls.has(cleanedUrl)) {
        return;
    }

    visitedUrls.add(cleanedUrl);

    try {
        console.log(`📄 Crawling: ${cleanedUrl} (${scrapedPages.length + 1}/10)`);

        // Fetch the page
        const response = await axios.get(cleanedUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBaseScraper/1.0)'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Remove script and style tags
        $('script, style, nav, footer, header[role="banner"]').remove();

        // Extract page title
        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';

        // Extract main content
        // Priority: main, article, .content, body
        let content = '';
        const mainContent = $('main, article, .content, .main-content, #content, #main').first();

        if (mainContent.length > 0) {
            content = mainContent.text();
        } else {
            content = $('body').text();
        }

        // Clean up the content
        content = content
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
            .trim();

        // Extract headings for structure
        const headings = [];
        $('h1, h2, h3').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text) {
                headings.push({
                    level: elem.name,
                    text: text
                });
            }
        });

        // Save the page data
        if (content.length > 100) { // Only save if there's substantial content
            scrapedPages.push({
                url: cleanedUrl,
                title: title,
                content: content.substring(0, 10000), // Limit content length
                headings: headings,
                scrapedAt: new Date().toISOString()
            });

            console.log(`✅ Saved page ${scrapedPages.length}/10: ${title}`);
        }

        // Stop if we've already hit the max page limit
        if (scrapedPages.length >= 10) {
            return;
        }

        // Find all links on the page
        const links = [];
        $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new URL(href, cleanedUrl).href;
                    const linkUrl = new URL(absoluteUrl);

                    // Clean the link URL
                    const cleanedLink = cleanUrl(absoluteUrl);

                    // Only follow links within the same domain that we haven't visited
                    if (linkUrl.origin === baseDomain && !visitedUrls.has(cleanedLink)) {
                        links.push(cleanedLink);
                    }
                } catch (e) {
                    // Invalid URL, skip
                }
            }
        });

        // Crawl child pages (limit to first 3 links per page to avoid explosion)
        const uniqueLinks = [...new Set(links)].slice(0, 3);
        for (const link of uniqueLinks) {
            // Stop if we've reached max pages
            if (scrapedPages.length >= 10) {
                console.log('⚠️ Reached max 10 pages limit, stopping crawl');
                break;
            }
            await crawlPage(link, baseDomain, visitedUrls, scrapedPages, depth + 1, maxDepth);
        }

    } catch (error) {
        console.error(`❌ Error crawling ${url}:`, error.message);
    }
}

/**
 * Generate intents from scraped content using AI
 */
async function generateIntents(scrapedData, anthropic) {
    try {
        console.log('🤖 Generating intents from scraped content...');

        if (!anthropic) {
            throw new Error('Anthropic API not available');
        }

        const allIntents = [];

        // Limit to first 10 pages to avoid timeout
        const pagesToProcess = scrapedData.pages.slice(0, 10);
        console.log(`Processing ${pagesToProcess.length} pages...`);

        for (const page of pagesToProcess) {
            console.log(`📋 Processing: ${page.title}`);

            // Split content into chunks if it's too long (limit to first 2 chunks per page)
            const chunks = splitIntoChunks(page.content, 3000).slice(0, 2);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                const prompt = `Analyze this website content and generate 3-4 intents (questions users might ask) with comprehensive answers.

Website: ${page.title}
URL: ${page.url}

Content:
${chunk}

Generate intents in this EXACT JSON format:
{
  "intents": [
    {
      "question": "What is [specific topic]?",
      "answer": "Comprehensive answer based on the content...",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Requirements:
1. Generate 3-4 diverse intents that users might ask
2. Each answer should be comprehensive (2-3 sentences)
3. Answers MUST be based ONLY on the provided content (no hallucination)
4. Include relevant keywords for search
5. Make questions natural and conversational
6. Cover different aspects of the content

Return ONLY the JSON, no explanation.`;

                try {
                    const response = await anthropic.messages.create({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 3000,
                        temperature: 0.3, // Lower temperature for accuracy
                        messages: [{ role: 'user', content: prompt }]
                    });

                    const responseText = response.content[0].text;

                    // Parse JSON response
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.intents && Array.isArray(parsed.intents)) {
                            allIntents.push(...parsed.intents.map(intent => ({
                                ...intent,
                                source: page.url,
                                sourceTitle: page.title
                            })));
                            console.log(`  ✅ Generated ${parsed.intents.length} intents (Total: ${allIntents.length})`);
                        }
                    }
                } catch (parseError) {
                    console.error(`❌ Failed to process chunk: ${parseError.message}`);
                }

                // Wait a bit to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`✅ Generated ${allIntents.length} intents`);

        return {
            success: true,
            intents: allIntents,
            totalIntents: allIntents.length
        };

    } catch (error) {
        console.error('❌ Intent generation error:', error.message);
        return {
            success: false,
            error: error.message,
            intents: []
        };
    }
}

/**
 * Split text into chunks
 */
function splitIntoChunks(text, maxLength) {
    const chunks = [];
    let currentChunk = '';

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
}

/**
 * Format scraped data as organized text file
 */
function formatAsTextFile(scrapedData, intents) {
    let textContent = '';

    textContent += `KNOWLEDGE BASE CONTENT\n`;
    textContent += `Source: ${scrapedData.url}\n`;
    textContent += `Scraped: ${new Date().toISOString()}\n`;
    textContent += `Total Pages: ${scrapedData.pages.length}\n`;
    textContent += `Total Intents: ${intents.length}\n`;
    textContent += `\n${'='.repeat(80)}\n\n`;

    // Add page contents
    for (const page of scrapedData.pages) {
        textContent += `PAGE: ${page.title}\n`;
        textContent += `URL: ${page.url}\n`;
        textContent += `${'-'.repeat(80)}\n`;
        textContent += `${page.content}\n`;
        textContent += `\n${'='.repeat(80)}\n\n`;
    }

    // Add generated intents
    textContent += `\nGENERATED INTENTS\n`;
    textContent += `${'-'.repeat(80)}\n\n`;

    for (let i = 0; i < intents.length; i++) {
        const intent = intents[i];
        textContent += `${i + 1}. ${intent.question}\n`;
        textContent += `   Answer: ${intent.answer}\n`;
        textContent += `   Keywords: ${intent.keywords.join(', ')}\n`;
        textContent += `   Source: ${intent.sourceTitle} (${intent.source})\n`;
        textContent += `\n`;
    }

    return textContent;
}

module.exports = {
    scrapeWebsite,
    generateIntents,
    formatAsTextFile
};
