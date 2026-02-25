<?php

namespace App\Http\Controllers;

use App\Models\DesignIcon;
use App\Models\IconLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class IconController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'label'    => ['required', 'string', 'max:100'],
            'category' => ['required', 'string', 'max:50'],
            'icon'     => ['required', 'file', 'mimes:svg,png', 'max:1024'],
        ]);

        $file = $request->file('icon');
        $mimeMap = ['image/svg+xml' => 'svg', 'image/png' => 'png'];
        $ext = $mimeMap[$file->getMimeType()] ?? null;

        if ($ext === null) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors'  => ['icon' => ['The icon must be an SVG or PNG file.']],
            ], 422);
        }

        $relativePath = 'icons/' . Auth::id() . '/' . Str::uuid() . '.' . $ext;
        \App\Models\FileUpload::create([
            'path' => $relativePath,
            'mime_type' => $file->getMimeType(),
            'base64_content' => base64_encode(file_get_contents($file->getRealPath())),
        ]);

        $icon = IconLibrary::create([
            'user_id'  => Auth::id(),
            'category' => $request->input('category'),
            'label'    => $request->input('label'),
            'svg_path' => $relativePath,
        ]);

        return response()->json(array_merge($icon->toArray(), [
            'url' => route('assets.show', ['path' => $relativePath]),
        ]), 201);
    }

    public function destroy(IconLibrary $iconLibrary): JsonResponse
    {
        abort_if($iconLibrary->user_id !== Auth::id(), 403);

        $usedInDesigns = DesignIcon::where('icon_library_id', $iconLibrary->id)->exists();

        $relativePath = $iconLibrary->svg_path;
        $iconLibrary->delete();
        \App\Models\FileUpload::where('path', $relativePath)->delete();

        return response()->json(['deleted' => true, 'was_in_use' => $usedInDesigns]);
    }
}
