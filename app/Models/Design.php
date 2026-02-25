<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Design extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function floorplans(): BelongsToMany
    {
        return $this->belongsToMany(Floorplan::class, 'design_floorplans')
                    ->withPivot('canvas_x')
                    ->orderByPivot('canvas_x');
    }

    public function keyEntries(): HasMany
    {
        return $this->hasMany(DesignKeyEntry::class);
    }

    public function roomHighlights(): HasMany
    {
        return $this->hasMany(DesignRoomHighlight::class);
    }

    public function icons(): HasMany
    {
        return $this->hasMany(DesignIcon::class);
    }
}
