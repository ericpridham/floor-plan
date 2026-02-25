<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IconLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class IconStateController extends Controller
{
    public function index(): JsonResponse
    {
        $builtIn = IconLibrary::whereNull('user_id')
            ->orderBy('category')
            ->orderBy('label')
            ->get()
            ->map(fn(IconLibrary $icon) => array_merge($icon->toArray(), [
                'url' => url($icon->svg_path),
            ]));

        $custom = IconLibrary::where('user_id', Auth::id())
            ->orderBy('category')
            ->orderBy('label')
            ->get()
            ->map(fn(IconLibrary $icon) => array_merge($icon->toArray(), [
                'url' => route('assets.show', ['path' => $icon->svg_path]),
            ]));

        return response()->json(['built_in' => $builtIn, 'custom' => $custom]);
    }
}
