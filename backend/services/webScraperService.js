// backend/services/webScraperService.js
// Web Scraping Service for Knowledge Base

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Scrape a website and extract all text content
 * @param {string} websiteUrl - URL to scrape
 * @param {boolean} singlePageOnly - If true, only scrape the specified page (no following links)
 */
async function scrapeWebsite(websiteUrl, singlePageOnly = true) {
    try {
        console.log(`🕷️ Starting scrape of: ${websiteUrl}`);
        console.log(`📄 Mode: ${singlePageOnly ? 'Single page only' : 'Multi-page (max 10)'}`);

        const visitedUrls = new Set();
        const scrapedPages = [];
        const baseUrl = new URL(websiteUrl);
        const baseDomain = baseUrl.origin;

        if (singlePageOnly) {
            // Only scrape the specified page, don't follow links
            await scrapeSinglePage(websiteUrl, scrapedPages);
        } else {
            // Crawl multiple pages (original behavior)
            await crawlPage(websiteUrl, baseDomain, visitedUrls, scrapedPages, 0, 10); // Max 10 pages
        }

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
 * Scrape a single page only (no following links)
 */
async function scrapeSinglePage(url, scrapedPages) {
    try {
        console.log(`📄 Scraping single page: ${url}`);

        const response = await axios.get(url, {
            timeout: 15000,
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

        console.log(`📋 Title: ${title}`);

        // Check if this is a FAQ page
        const isFAQ = title.toLowerCase().includes('faq') ||
            url.toLowerCase().includes('faq') ||
            $('h1, h2').text().toLowerCase().includes('frequently asked questions');

        let content = '';
        let faqPairs = [];

        if (isFAQ) {
            console.log('🔍 Detected FAQ page - extracting Q&A pairs');
            faqPairs = extractFAQPairs($);

            if (faqPairs.length > 0) {
                console.log(`✅ Extracted ${faqPairs.length} FAQ pairs`);
                // Format FAQ pairs as content
                content = faqPairs.map(pair => `Q: ${pair.question}\nA: ${pair.answer}`).join('\n\n');
            }
        }

        // If no FAQ pairs found, extract regular content
        if (!content) {
            const mainContent = $('main, article, .content, .main-content, #content, #main').first();

            if (mainContent.length > 0) {
                content = mainContent.text();
            } else {
                content = $('body').text();
            }

            // Clean up the content
            content = content
                .replace(/\s+/g, ' ')
                .replace(/\n+/g, '\n')
                .trim();
        }

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
        if (content.length > 100) {
            scrapedPages.push({
                url: url,
                title: title,
                content: content,
                headings: headings,
                isFAQ: isFAQ,
                faqPairs: faqPairs,
                scrapedAt: new Date().toISOString()
            });

            console.log(`✅ Saved page: ${title} (${content.length} chars, ${isFAQ ? faqPairs.length + ' FAQ pairs' : 'regular content'})`);
        }

    } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error.message);
    }
}

/**
 * Extract FAQ Q&A pairs from page
 */
function extractFAQPairs($) {
    const faqPairs = [];

    // Method 1: Look for accordion/details elements
    $('details, .accordion-item, .faq-item, [class*="faq"]').each((i, elem) => {
        const $elem = $(elem);
        const question = $elem.find('summary, .question, [class*="question"], h3, h4').first().text().trim();
        const answer = $elem.find('.answer, [class*="answer"], p').text().trim() ||
            $elem.text().replace(question, '').trim();

        if (question && answer && answer.length > 20) {
            faqPairs.push({ question, answer });
        }
    });

    // Method 2: Look for dt/dd pairs
    if (faqPairs.length === 0) {
        $('dt').each((i, elem) => {
            const question = $(elem).text().trim();
            const answer = $(elem).next('dd').text().trim();

            if (question && answer && answer.length > 20) {
                faqPairs.push({ question, answer });
            }
        });
    }

    // Method 3: Look for h3/h4 followed by paragraphs
    if (faqPairs.length === 0) {
        $('h3, h4').each((i, elem) => {
            const $heading = $(elem);
            const question = $heading.text().trim();

            if (question.includes('?') || question.toLowerCase().match(/^(what|how|why|when|where|can|do|does|is|are)/)) {
                let answer = '';
                $heading.nextUntil('h3, h4').each((j, next) => {
                    if ($(next).is('p')) {
                        answer += $(next).text().trim() + ' ';
                    }
                });

                answer = answer.trim();

                if (question && answer && answer.length > 20) {
                    faqPairs.push({ question, answer });
                }
            }
        });
    }

    return faqPairs;
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

            // ✅ SPECIAL HANDLING FOR FAQ PAGES
            // Use AI to create proper short variations from FAQ Q&A pairs
            if (page.isFAQ && page.faqPairs && page.faqPairs.length > 0) {
                console.log(`✅ FAQ page detected with ${page.faqPairs.length} Q&A pairs - using AI for short variations`);

                // Process FAQ pairs in batches of 10 to avoid timeouts
                const batchSize = 10;
                for (let batchStart = 0; batchStart < page.faqPairs.length; batchStart += batchSize) {
                    const batch = page.faqPairs.slice(batchStart, batchStart + batchSize);
                    console.log(`  📋 Processing FAQ batch ${Math.floor(batchStart / batchSize) + 1} (${batch.length} Q&A pairs)`);

                    // Format batch for AI
                    const faqText = batch.map((pair, idx) =>
                        `${idx + 1}. Q: ${pair.question}\n   A: ${pair.answer}`
                    ).join('\n\n');

                    const prompt = `You are converting FAQ Q&A pairs into conversational chatbot responses with EXCELLENT keyword coverage.

FAQ Content:
${faqText}

For EACH question above, create:
- 3 SHORT response variations (max 2 sentences each)
- 8-12 keywords/phrases that users might type when asking this question

CRITICAL RULES:
1. Each variation must be DIFFERENT (different wording, not just prefixes)
2. Keep responses SHORT (1-2 sentences maximum)
3. Break long answers into key points
4. Use conversational, natural language
5. Responses must be based ONLY on the answer provided (no hallucination)
6. Keywords MUST include:
   a. The original question itself (cleaned up)
   b. 3-4 short rephrasings of the question (how users might actually ask it)
   c. 3-5 specific topic keywords/phrases from the Q&A
   d. Common abbreviations or alternate terms

Return EXACT JSON format:
{
  "intents": [
    {
      "question": "Original question",
      "responses": [
        "Short variation 1 (1-2 sentences, different phrasing)",
        "Short variation 2 (1-2 sentences, completely different wording)",
        "Short variation 3 (1-2 sentences, another angle)"
      ],
      "keywords": ["original question cleaned", "rephrasing 1", "rephrasing 2", "topic keyword 1", "topic keyword 2", ...]
    }
  ]
}

EXAMPLES:

Q: How many shareholders are allowed?
A: A maximum of 50 shareholders are allowed on a license.

Good keywords: ["how many shareholders are allowed", "shareholders allowed", "maximum shareholders", "number of shareholders", "shareholder limit", "50 shareholders", "shareholders on license", "how many shareholders can I have"]

Good variations:
1. "You can have up to 50 shareholders on your license."
2. "The maximum is 50 shareholders per license."
3. "Meydan Free Zone allows a maximum of 50 shareholders."

Bad keywords (DON'T DO THIS): ["shareholders", "allowed", "maximum"] (too generic, too few)

Return ONLY the JSON, no explanation.`;

                    try {
                        const response = await anthropic.messages.create({
                            model: 'claude-sonnet-4-20250514',
                            max_tokens: 4000,
                            temperature: 0.5, // Balanced for variation but not too creative
                            messages: [{ role: 'user', content: prompt }]
                        });

                        const responseText = response.content[0].text;
                        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.intents && Array.isArray(parsed.intents)) {
                                for (const intent of parsed.intents) {
                                    // Ensure question is always included as a keyword
                                    const keywords = intent.keywords || [];
                                    const cleanQuestion = intent.question.replace(/[?!.,]/g, '').trim().toLowerCase();
                                    if (!keywords.some(k => k.toLowerCase() === cleanQuestion)) {
                                        keywords.unshift(cleanQuestion);
                                    }
                                    // Also add a shorter version if question is long
                                    if (cleanQuestion.split(' ').length > 5) {
                                        const shortVersion = cleanQuestion.split(' ').slice(0, 5).join(' ');
                                        if (!keywords.some(k => k.toLowerCase() === shortVersion)) {
                                            keywords.push(shortVersion);
                                        }
                                    }

                                    allIntents.push({
                                        name: intent.question.substring(0, 60) + (intent.question.length > 60 ? '...' : ''),
                                        question: intent.question,
                                        responses: intent.responses || [intent.question],
                                        keywords: keywords,
                                        source: page.url,
                                        sourceTitle: page.title
                                    });
                                }
                                console.log(`  ✅ Generated ${parsed.intents.length} FAQ intents (Total: ${allIntents.length})`);
                            }
                        }
                    } catch (parseError) {
                        console.error(`  ❌ Failed to process FAQ batch: ${parseError.message}`);
                    }

                    // Wait to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                console.log(`✅ Created ${allIntents.length} intents from FAQ page`);
                continue; // Skip regular AI processing for FAQ pages
            }

            // ✅ REGULAR CONTENT (NOT FAQ) - Use AI to generate intents
            // Split content into chunks if it's too long (limit to first 2 chunks per page)
            const chunks = splitIntoChunks(page.content, 3000).slice(0, 2);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                const prompt = `Analyze this website content and generate 3-4 intents (questions users might ask) with multiple short answer variations and COMPREHENSIVE keyword coverage.

Website: ${page.title}
URL: ${page.url}

Content:
${chunk}

Generate intents in this EXACT JSON format:
{
  "intents": [
    {
      "name": "Brief descriptive name (3-5 words)",
      "question": "What is [specific topic]?",
      "responses": [
        "Short answer variation 1 (2-3 sentences, conversational)",
        "Short answer variation 2 (2-3 sentences, different phrasing)",
        "Short answer variation 3 (2-3 sentences, another angle)"
      ],
      "keywords": ["the full question", "rephrasing 1", "rephrasing 2", "topic keyword 1", "topic keyword 2", ...]
    }
  ]
}

Requirements:
1. Generate 3-4 diverse intents that users might ask
2. Each "name" should be a brief, descriptive title (e.g., "VARA Regulations Overview", "Company Formation Cost")
3. Each intent should have 3 SHORT response variations (2-3 sentences each, NOT long paragraphs)
4. Make each response variation sound human and conversational, not robotic
5. Vary the phrasing and angle of each response while keeping the core information
6. Responses MUST be based ONLY on the provided content (no hallucination)
7. Keywords (8-12 per intent) MUST include:
   a. The full question itself (e.g., "what is VARA regulation")
   b. 3-4 ways users might rephrase the same question (e.g., "tell me about VARA", "VARA rules")
   c. 3-5 specific topic keywords/phrases (e.g., "VARA", "virtual assets license", "crypto regulation")
   d. Common abbreviations or alternate terms
8. Avoid single generic keywords like "company", "business", "services" — use specific multi-word phrases
9. Make questions natural and conversational
10. Cover different aspects of the content

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
                            allIntents.push(...parsed.intents.map(intent => {
                                // Ensure question is always included as a keyword
                                const keywords = intent.keywords || [];
                                if (intent.question) {
                                    const cleanQuestion = intent.question.replace(/[?!.,]/g, '').trim().toLowerCase();
                                    if (!keywords.some(k => k.toLowerCase() === cleanQuestion)) {
                                        keywords.unshift(cleanQuestion);
                                    }
                                    if (cleanQuestion.split(' ').length > 5) {
                                        const shortVersion = cleanQuestion.split(' ').slice(0, 5).join(' ');
                                        if (!keywords.some(k => k.toLowerCase() === shortVersion)) {
                                            keywords.push(shortVersion);
                                        }
                                    }
                                }
                                return {
                                    ...intent,
                                    keywords,
                                    source: page.url,
                                    sourceTitle: page.title
                                };
                            }));
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

        // Support both new format (responses array) and old format (single answer)
        if (intent.responses && Array.isArray(intent.responses)) {
            textContent += `   Responses (${intent.responses.length} variations):\n`;
            intent.responses.forEach((resp, idx) => {
                textContent += `     ${idx + 1}. ${resp}\n`;
            });
        } else if (intent.answer) {
            textContent += `   Answer: ${intent.answer}\n`;
        }

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
