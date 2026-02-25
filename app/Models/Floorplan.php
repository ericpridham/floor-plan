<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Floorplan extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name', 'image_path', 'width_px', 'height_px'];

    protected $appends = ['thumbnail_url'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function designs(): BelongsToMany
    {
        return $this->belongsToMany(Design::class, 'design_floorplans');
    }

    public function getThumbnailUrlAttribute(): string
    {
        return route('assets.show', ['path' => $this->image_path]);
    }

    public function deleteImage(): void
    {
        \App\Models\FileUpload::where('path', $this->image_path)->delete();
    }
}
