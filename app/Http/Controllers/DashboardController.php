<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function index()
    {
        $floorplans = Auth::user()
            ->floorplans()
            ->withCount(['rooms', 'designs'])
            ->latest()
            ->get();

        return view('dashboard', compact('floorplans'));
    }
}
