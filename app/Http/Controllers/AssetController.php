<?php

namespace App\Http\Controllers;

use App\Models\FileUpload;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function show($path)
    {
        $file = FileUpload::where('path', $path)->firstOrFail();

        return response(base64_decode($file->base64_content))
            ->header('Content-Type', $file->mime_type)
            ->header('Cache-Control', 'public, max-age=31536000');
    }
}
