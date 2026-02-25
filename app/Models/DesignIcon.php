<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignIcon extends Model
{
    use HasFactory;
    protected $fillable = ['design_id', 'icon_library_id', 'x', 'y', 'width', 'height', 'rotation', 'is_free_placed', 'z_order'];

    protected $casts = [
        'x' => 'float', 'y' => 'float', 'width' => 'float',
        'height' => 'float', 'rotation' => 'float', 'is_free_placed' => 'boolean',
    ];

    public function design(): BelongsTo { return $this->belongsTo(Design::class); }

    public function iconLibrary(): BelongsTo
    {
        return $this->belongsTo(IconLibrary::class);
    }
}
