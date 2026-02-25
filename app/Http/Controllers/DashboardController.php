<?php
namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function index()
    {
        $floorplans = Auth::user()->floorplans()->withCount(['rooms', 'designs'])->latest()->get();
        $designs    = Auth::user()->designs()->withCount('floorplans')->latest('updated_at')->get();
        return view('dashboard', compact('floorplans', 'designs'));
    }
}
