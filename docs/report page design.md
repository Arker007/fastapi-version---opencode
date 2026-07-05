<!DOCTYPE html><html class="light" lang="en" style=""><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>InvoiceFlow - Reports &amp; Business Intelligence</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "error": "#ba1a1a",
                        "on-tertiary-container": "#008cc7",
                        "on-surface-variant": "#45464d",
                        "surface-bright": "#f7f9fb",
                        "on-tertiary-fixed-variant": "#004c6e",
                        "tertiary-fixed": "#c9e6ff",
                        "on-primary-fixed-variant": "#3f465c",
                        "secondary-container": "#d5e3fd",
                        "on-tertiary-fixed": "#001e2f",
                        "secondary-fixed": "#d5e3fd",
                        "primary": "#000000",
                        "on-surface": "#191c1e",
                        "surface-container-high": "#e6e8ea",
                        "primary-container": "#131b2e",
                        "on-error": "#ffffff",
                        "on-secondary-fixed": "#0d1c2f",
                        "secondary": "#515f74",
                        "on-secondary-container": "#57657b",
                        "outline": "#76777d",
                        "surface-tint": "#565e74",
                        "primary-fixed": "#dae2fd",
                        "on-background": "#191c1e",
                        "primary-fixed-dim": "#bec6e0",
                        "surface-variant": "#e0e3e5",
                        "tertiary-container": "#001e2f",
                        "error-container": "#ffdad6",
                        "surface-container-lowest": "#ffffff",
                        "outline-variant": "#c6c6cd",
                        "inverse-primary": "#bec6e0",
                        "surface-dim": "#d8dadc",
                        "surface-container-highest": "#e0e3e5",
                        "inverse-on-surface": "#eff1f3",
                        "on-error-container": "#93000a",
                        "on-tertiary": "#ffffff",
                        "inverse-surface": "#2d3133",
                        "surface": "#f7f9fb",
                        "background": "#f7f9fb",
                        "secondary-fixed-dim": "#b9c7e0",
                        "on-secondary": "#ffffff",
                        "surface-container-low": "#f2f4f6",
                        "on-primary-container": "#7c839b",
                        "on-secondary-fixed-variant": "#3a485c",
                        "tertiary-fixed-dim": "#89ceff",
                        "on-primary": "#ffffff",
                        "surface-container": "#eceef0",
                        "tertiary": "#000000",
                        "on-primary-fixed": "#131b2e"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "sidebar-width": "240px",
                        "gutter": "16px",
                        "base": "4px",
                        "stack-md": "16px",
                        "stack-sm": "8px",
                        "container-padding": "24px",
                        "stack-lg": "24px"
                    },
                    "fontFamily": {
                        "headline-lg": ["Inter"],
                        "body-lg": ["Inter"],
                        "headline-md": ["Inter"],
                        "body-md": ["Inter"],
                        "label-caps": ["Inter"],
                        "headline-xl": ["Inter"],
                        "label-md": ["Inter"],
                        "body-sm": ["Inter"]
                    },
                    "fontSize": {
                        "headline-lg": ["20px", {"lineHeight": "28px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                        "headline-md": ["16px", {"lineHeight": "24px", "fontWeight": "600"}],
                        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
                        "label-caps": ["11px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                        "headline-xl": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                        "label-md": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                        "body-sm": ["13px", {"lineHeight": "18px", "fontWeight": "400"}]
                    }
                },
            },
        }
    </script>
<style>
        body { font-family: 'Inter', sans-serif; }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            vertical-align: middle;
        }
        .data-grid-header { background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
        .data-grid-row { border-bottom: 1px solid #E2E8F0; transition: background-color 0.15s ease; }
        .data-grid-row:hover { background-color: #F0F9FF; }
        .sidebar-item { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    </style>
</head>
<body class="bg-surface text-on-surface min-h-screen flex">
<!-- SideNavBar Shell -->
<aside class="w-sidebar-width h-screen sticky left-0 top-0 border-r border-outline-variant bg-surface-container-lowest flex flex-col py-container-padding">
<div class="px-gutter mb-stack-lg">
<h1 class="text-headline-xl font-headline-xl font-black text-primary flex items-center gap-2">
<span class="material-symbols-outlined text-primary" data-icon="receipt_long">receipt_long</span>
                InvoiceFlow
            </h1>
</div>
<nav class="flex-1 px-3 space-y-6 overflow-y-auto">
<!-- MAIN MENU -->
<div>
<p class="px-3 mb-2 font-label-caps text-label-caps text-outline uppercase tracking-wider">Main Menu</p>
<ul class="space-y-1">
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
                            Dashboard
                        </a>
</li>
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="add_box">add_box</span>
                            Create Invoice
                        </a>
</li>
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
                            Invoices List
                        </a>
</li>
</ul>
</div>
<!-- INVENTORY & CRM -->
<div>
<p class="px-3 mb-2 font-label-caps text-label-caps text-outline uppercase tracking-wider">Inventory &amp; CRM</p>
<ul class="space-y-1">
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="inventory_2">inventory_2</span>
                            Products &amp; Stock
                        </a>
</li>
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="group">group</span>
                            Customers
                        </a>
</li>
</ul>
</div>
<!-- ANALYSIS (ACTIVE) -->
<div>
<p class="px-3 mb-2 font-label-caps text-label-caps text-outline uppercase tracking-wider">Analysis</p>
<ul class="space-y-1">
<li class="sidebar-item bg-secondary-container text-on-secondary-container rounded-full font-semibold border-l-4 border-primary">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="analytics" style="font-variation-settings: &quot;FILL&quot; 1;">analytics</span>
                            Reports Directory
                        </a>
</li>
</ul>
</div>
<!-- ADMINISTRATION -->
<div>
<p class="px-3 mb-2 font-label-caps text-label-caps text-outline uppercase tracking-wider">Administration</p>
<ul class="space-y-1">
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
                            Admin Panel
                        </a>
</li>
<li class="sidebar-item group text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg">
<a class="flex items-center px-3 py-2 gap-3 font-body-sm text-body-sm" href="#">
<span class="material-symbols-outlined" data-icon="history">history</span>
                            System Logs
                        </a>
</li>
</ul>
</div>
</nav>
<!-- Footer -->
<div class="px-3 pt-4 border-t border-outline-variant space-y-4">
<div class="flex items-center gap-3 px-3">
<div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
<span class="material-symbols-outlined" data-icon="person">person</span>
</div>
<div class="overflow-hidden">
<p class="font-headline-md text-headline-md truncate leading-tight">System Administrator</p>
<p class="font-body-sm text-body-sm text-on-surface-variant">Admin</p>
</div>
</div>
<button class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-error-container/10 text-error hover:bg-error-container/20 transition-all rounded-lg font-body-sm text-body-sm">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
                Logout
            </button>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-1 flex flex-col min-h-screen overflow-x-hidden">
<!-- TopAppBar Shell -->
<header class="w-full h-16 flex justify-between items-center px-gutter py-stack-md bg-surface border-b border-outline-variant/30">
<h2 class="font-headline-xl text-headline-xl text-on-surface">Reports &amp; Business Intelligence</h2>
<div class="flex items-center gap-stack-md">
<div class="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-lg bg-surface-container-lowest">
<span class="material-symbols-outlined text-on-surface-variant text-sm" data-icon="calendar_today">calendar_today</span>
<span class="font-label-md text-label-md text-on-surface">Tuesday, 23 June 2026</span>
</div>
<button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-variant/50 transition-colors text-on-surface-variant">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
</div>
</header>
<!-- Canvas -->
<div class="p-gutter space-y-gutter flex-1 overflow-y-auto">
<!-- Select Report Card -->
<section class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-container-padding">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-stack-md mb-stack-lg">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-on-tertiary-container" data-icon="show_chart">show_chart</span>
<h3 class="font-headline-lg text-headline-lg">Select Report</h3>
</div>
<div class="flex items-center gap-stack-sm">
<button class="flex items-center gap-2 bg-on-tertiary-container text-white px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity">
<span class="material-symbols-outlined text-[18px]" data-icon="csv">csv</span>
                            Export CSV
                        </button>
<button class="flex items-center gap-2 bg-white border border-outline-variant text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-container transition-colors">
<span class="material-symbols-outlined text-[18px]" data-icon="print">print</span>
                            Print Report
                        </button>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
<div class="space-y-1.5">
<label class="font-label-md text-label-md text-on-surface-variant px-0.5">Choose Report Type</label>
<div class="relative group">
<select class="w-full h-[40px] appearance-none bg-surface-container-low border border-outline-variant rounded-lg px-3 pr-10 font-body-md text-body-md focus:border-on-tertiary-container focus:ring-1 focus:ring-on-tertiary-container transition-all">
<option>1. Daily Sales Report</option>
<option>2. Monthly Revenue Growth</option>
<option>3. Product Performance Matrix</option>
<option>4. Customer Lifetime Value</option>
</select>
<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" data-icon="expand_more">expand_more</span>
</div>
</div>
<div class="space-y-1.5">
<label class="font-label-md text-label-md text-on-surface-variant px-0.5">Search/Filter Grid</label>
<div class="relative">
<input class="w-full h-[40px] bg-surface-container-low border border-outline-variant rounded-lg px-3 font-body-md text-body-md focus:border-on-tertiary-container focus:ring-1 focus:ring-on-tertiary-container transition-all" placeholder="Type to filter rows..." type="text">
<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" data-icon="search">search</span>
</div>
</div>
</div>
</section>
<!-- Results Card -->
<section class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-hidden">
<div class="px-container-padding py-stack-md border-b border-outline-variant/30">
<h3 class="font-headline-md text-headline-md">1. Daily Sales Report</h3>
</div>
<div class="overflow-x-auto">
<table class="w-full border-collapse">
<thead class="data-grid-header">
<tr>
<th class="px-6 py-4 text-left font-label-caps text-label-caps text-outline">DATE</th>
<th class="px-6 py-4 text-left font-label-caps text-label-caps text-outline">BILLS ISSUED</th>
<th class="px-6 py-4 text-right font-label-caps text-label-caps text-outline">SUBTOTAL (₹)</th>
<th class="px-6 py-4 text-right font-label-caps text-label-caps text-outline">DISCOUNTS GIVEN (₹)</th>
<th class="px-6 py-4 text-right font-label-caps text-label-caps text-outline">GST TAX COLLECTED (₹)</th>
<th class="px-6 py-4 text-right font-label-caps text-label-caps text-outline">NET SALES REVENUE (₹)</th>
</tr>
</thead>
<tbody class="divide-y divide-outline-variant/20">
<tr class="data-grid-row" style="transform: translateX(0px);">
<td class="px-6 py-5 font-body-md text-body-md text-on-surface">23/6/2026</td>
<td class="px-6 py-5 font-body-md text-body-md text-on-surface">1</td>
<td class="px-6 py-5 font-body-md text-body-md text-on-surface text-right">₹180.00</td>
<td class="px-6 py-5 font-body-md text-body-md text-on-surface text-right">₹0.00</td>
<td class="px-6 py-5 font-body-md text-body-md text-on-surface text-right">₹32.40</td>
<td class="px-6 py-5 font-body-md text-body-md font-semibold text-on-surface text-right">₹212.40</td>
</tr>
<!-- Empty states/filler rows for design density -->
<tr class="data-grid-row opacity-30" style="transform: translateX(0px);">
<td class="px-6 py-5 font-body-md text-body-md">22/6/2026</td>
<td class="px-6 py-5 font-body-md text-body-md">12</td>
<td class="px-6 py-5 text-right">₹2,450.00</td>
<td class="px-6 py-5 text-right">₹120.00</td>
<td class="px-6 py-5 text-right">₹441.00</td>
<td class="px-6 py-5 text-right">₹2,771.00</td>
</tr>
</tbody>
<tfoot class="bg-surface-container-low/50">
<tr>
<td class="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">TOTAL</td>
<td class="px-6 py-4 font-headline-md text-headline-md">13</td>
<td class="px-6 py-4 text-right font-headline-md text-headline-md">₹2,630.00</td>
<td class="px-6 py-4 text-right font-headline-md text-headline-md">₹120.00</td>
<td class="px-6 py-4 text-right font-headline-md text-headline-md">₹473.40</td>
<td class="px-6 py-4 text-right font-headline-md text-headline-md text-on-tertiary-container">₹2,983.40</td>
</tr>
</tfoot>
</table>
</div>
</section>
<!-- Insight Bento Grid Section (Added for "High-end UI" pattern requirement) -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-stack-lg">



</div>
</div>
</main>
<script>
        // Micro-interaction for hover states on data rows
        document.querySelectorAll('.data-grid-row').forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.transform = 'translateX(4px)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.transform = 'translateX(0)';
            });
        });

        // Simulating search filtering
        const searchInput = document.querySelector('input[type="text"]');
        const tableRows = document.querySelectorAll('.data-grid-row');
        
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            tableRows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    </script>


</body></html>