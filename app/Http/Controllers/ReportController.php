<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    /**
     * Display Sales & Profit Report Dashboard
     */
    public function index(Request $request): Response
    {
        $startDate = $request->get('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->get('end_date', now()->endOfDay()->toDateString());

        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->endOfDay();

        // 1. Total Metrics
        $salesQuery = Sale::where('status', 'completed')
            ->whereBetween('created_at', [$start, $end]);

        $totalRevenue = (float) $salesQuery->sum('grand_total');
        $totalHpp = (float) $salesQuery->sum('total_buy_price');
        $totalGrossProfit = $totalRevenue - $totalHpp;
        $totalTransactions = $salesQuery->count();

        // 2. Sales by Payment Method
        $paymentBreakdown = DB::table('payment_details')
            ->join('sales', 'payment_details.sale_id', '=', 'sales.id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$start, $end])
            ->select('payment_details.payment_type', DB::raw('SUM(payment_details.amount) as total_amount'), DB::raw('COUNT(payment_details.id) as count'))
            ->groupBy('payment_details.payment_type')
            ->get();

        // 3. Top 10 Fast-Moving Products
        $topProducts = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$start, $end])
            ->select(
                'products.id',
                'products.name',
                'products.barcode',
                DB::raw('SUM(sale_items.qty) as total_qty'),
                DB::raw('SUM(sale_items.subtotal) as total_sales'),
                DB::raw('SUM(sale_items.subtotal - (sale_items.buy_price * sale_items.qty)) as total_profit')
            )
            ->groupBy('products.id', 'products.name', 'products.barcode')
            ->orderByDesc('total_qty')
            ->take(10)
            ->get();

        // 4. Recent Shift Audits (Cash Discrepancy)
        $shiftAudits = Shift::with(['user'])
            ->whereBetween('opened_at', [$start, $end])
            ->latest('opened_at')
            ->take(15)
            ->get();

        // 5. Recent Sales Transactions
        $recentSales = Sale::with(['cashier', 'items.product', 'paymentDetails'])
            ->whereBetween('created_at', [$start, $end])
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Reports/Index', [
            'metrics' => [
                'totalRevenue' => $totalRevenue,
                'totalHpp' => $totalHpp,
                'totalGrossProfit' => $totalGrossProfit,
                'totalTransactions' => $totalTransactions,
                'profitMargin' => $totalRevenue > 0 ? round(($totalGrossProfit / $totalRevenue) * 100, 1) : 0,
            ],
            'paymentBreakdown' => $paymentBreakdown,
            'topProducts' => $topProducts,
            'shiftAudits' => $shiftAudits,
            'recentSales' => $recentSales,
            'filters' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    }
}
