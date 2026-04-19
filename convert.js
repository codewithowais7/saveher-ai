const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'scratch_html');
const appDir = path.join(__dirname, 'app');

const files = {
    'Landing.html': 'page.tsx',
    'Upload.html': 'upload/page.tsx',
    'Result.html': 'result/page.tsx',
    'Complaint.html': 'complaint/page.tsx',
    'SOS.html': 'sos/page.tsx',
    'Profile.html': 'profile/page.tsx',
    'HowItWorks.html': 'how-it-works/page.tsx'
};

for (const [htmlFile, destFile] of Object.entries(files)) {
    const htmlPath = path.join(srcDir, htmlFile);
    if (!fs.existsSync(htmlPath)) continue;

    let content = fs.readFileSync(htmlPath, 'utf8');

    // Extract body content
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) continue;
    
    let body = bodyMatch[1];
    
    // Convert class to className
    body = body.replace(/class="/g, 'className="');
    // Convert for to htmlFor
    body = body.replace(/for="/g, 'htmlFor="');
    // Make tags self closing
    body = body.replace(/<img(.*?)>/g, (match) => match.endsWith('/>') ? match : match.replace('>', '/>'));
    body = body.replace(/<br(.*?)>/g, (match) => match.endsWith('/>') ? match : match.replace('>', '/>'));
    body = body.replace(/<input(.*?)>/g, (match) => match.endsWith('/>') ? match : match.replace('>', '/>'));
    body = body.replace(/<hr(.*?)>/g, (match) => match.endsWith('/>') ? match : match.replace('>', '/>'));
    
    // React prop names
    body = body.replace(/readonly=""/g, 'readOnly={true}');
    body = body.replace(/autocomplete="/g, 'autoComplete="');
    body = body.replace(/tabindex="/g, 'tabIndex="');
    body = body.replace(/maxlength="/g, 'maxLength="');

    body = body.replace(/style="animation-delay:\s*(.*?);?"/g, 'style={{ animationDelay: "$1" }}');
    body = body.replace(/style="font-variation-settings:\s*(.*?);?"/g, 'style={{ fontVariationSettings: "$1" }}');
    body = body.replace(/style={{ animationDelay: "(.*?)" }}/g, "style={{ animationDelay: '$1' }}");

    // Fix SVGs
    body = body.replace(/stroke-width="/g, 'strokeWidth="');
    body = body.replace(/stroke-linecap="/g, 'strokeLinecap="');
    body = body.replace(/stroke-linejoin="/g, 'strokeLinejoin="');

    // Remove comments
    body = body.replace(/<!--[\s\S]*?-->/g, '');

    // LINK MAPPING LOGIC
    body = body.replace(/<a /g, '<Link ');
    body = body.replace(/<\/a>/g, '</Link>');
    
    body = body.replace(/href="#"/g, 'href="/"'); // Default all to /
    body = body.replace(/(<Link[^>]*href=")\/"([^>]*>.*?(?:How it works).*?<\/Link>)/gi, '$1/how-it-works"$2');
    body = body.replace(/(<Link[^>]*href=")\/"([^>]*>.*?(?:Report|Complaint).*?<\/Link>)/gi, '$1/complaint"$2');
    body = body.replace(/(<Link[^>]*href=")\/"([^>]*>.*?(?:Emergency Protocol|SOS).*?<\/Link>)/gi, '$1/sos"$2');
    body = body.replace(/(<Link[^>]*href=")\/"([^>]*>.*?(?:Profile).*?<\/Link>)/gi, '$1/profile"$2');
    
    // Split on buttons to safely replace
    const parts = body.split(/(<button[\s\S]*?<\/button>)/i);
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith('<button')) {
            if (parts[i].match(/Analyze Harassment/i)) {
                parts[i] = '<Link href="/upload">' + parts[i] + '</Link>';
            } else if (parts[i].match(/SOS Emergency/i)) {
                parts[i] = '<Link href="/sos">' + parts[i] + '</Link>';
            } else if (parts[i].match(/Submit Complaint/i)) {
                parts[i] = '<Link href="/result">' + parts[i] + '</Link>';
            } else if (parts[i].match(/Create Private Account|Save Changes|Get Protected/i)) {
                parts[i] = '<Link href="/profile">' + parts[i] + '</Link>';
            }
        }
    }
    body = parts.join('');

    const tsxContent = `
import Link from 'next/link';

export default function Page() {
  return (
    <>
      ${body}
    </>
  );
}
`;

    const destPath = path.join(appDir, destFile);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(destPath, tsxContent);
    console.log(`Converted ${htmlFile} to ${destFile} with Links updated`);
}
