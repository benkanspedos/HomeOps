import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HomeOps Style Test</title>
      <link rel="stylesheet" href="/_next/static/css/app/layout.css">
    </head>
    <body class="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-8">HomeOps Style Test</h1>
        
        <div class="grid gap-4">
          <!-- Test Tailwind Utilities -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-semibold mb-4 text-primary-600">TailwindCSS Test</h2>
            <p class="text-gray-700 dark:text-gray-300 mb-4">
              Basic Tailwind utilities are working if you see proper styling.
            </p>
            <div class="flex gap-2">
              <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Blue Button</button>
              <button class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Green Button</button>
              <button class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Red Button</button>
            </div>
          </div>
          
          <!-- Test Custom Colors -->
          <div class="bg-card rounded-lg border border-border p-6">
            <h2 class="text-2xl font-semibold mb-4">Custom Theme Colors</h2>
            <div class="space-y-2">
              <div class="p-2 bg-primary text-primary-foreground rounded">Primary Color</div>
              <div class="p-2 bg-secondary text-secondary-foreground rounded">Secondary Color</div>
              <div class="p-2 bg-accent text-accent-foreground rounded">Accent Color</div>
              <div class="p-2 bg-muted text-muted-foreground rounded">Muted Color</div>
            </div>
          </div>
          
          <!-- Test Animations -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-semibold mb-4">Animations</h2>
            <div class="flex gap-4">
              <div class="w-16 h-16 bg-blue-500 rounded animate-spin-slow"></div>
              <div class="w-16 h-16 bg-green-500 rounded animate-pulse-slow"></div>
              <div class="w-16 h-16 bg-purple-500 rounded animate-bounce"></div>
            </div>
          </div>
        </div>
        
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-500">
            If all styles are working, you should see properly formatted cards, colors, and animations.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}