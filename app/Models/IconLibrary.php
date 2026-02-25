<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IconLibrary extends Model
{
    protected $table = 'icon_libraries';
    protected $fillable = ['user_id', 'category', 'label', 'svg_path'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function designIcons(): HasMany
    {
        return $this->hasMany(DesignIcon::class);
    }
}
