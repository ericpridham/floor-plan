<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class IconLibrarySeeder extends Seeder
{
    public function run(): void
    {
        $icons = [
            ['category' => 'Furniture', 'label' => 'Chair',          'svg_path' => '/icons/furniture/chair.svg'],
            ['category' => 'Furniture', 'label' => 'Sofa',           'svg_path' => '/icons/furniture/sofa.svg'],
            ['category' => 'Furniture', 'label' => 'Bed',            'svg_path' => '/icons/furniture/bed.svg'],
            ['category' => 'Furniture', 'label' => 'Desk',           'svg_path' => '/icons/furniture/desk.svg'],
            ['category' => 'Furniture', 'label' => 'Wardrobe',       'svg_path' => '/icons/furniture/wardrobe.svg'],
            ['category' => 'Furniture', 'label' => 'Bookshelf',      'svg_path' => '/icons/furniture/bookshelf.svg'],
            ['category' => 'Furniture', 'label' => 'Dresser',        'svg_path' => '/icons/furniture/dresser.svg'],
            ['category' => 'Furniture', 'label' => 'Dining Table',   'svg_path' => '/icons/furniture/dining-table.svg'],
            ['category' => 'Furniture', 'label' => 'Coffee Table',   'svg_path' => '/icons/furniture/coffee-table.svg'],
            ['category' => 'Furniture', 'label' => 'Nightstand',     'svg_path' => '/icons/furniture/nightstand.svg'],
            ['category' => 'Appliances', 'label' => 'Refrigerator',  'svg_path' => '/icons/appliances/refrigerator.svg'],
            ['category' => 'Appliances', 'label' => 'Stove',         'svg_path' => '/icons/appliances/stove.svg'],
            ['category' => 'Appliances', 'label' => 'Washing Machine', 'svg_path' => '/icons/appliances/washing-machine.svg'],
            ['category' => 'Appliances', 'label' => 'Dryer',         'svg_path' => '/icons/appliances/dryer.svg'],
            ['category' => 'Appliances', 'label' => 'Dishwasher',    'svg_path' => '/icons/appliances/dishwasher.svg'],
            ['category' => 'Fixtures',   'label' => 'Toilet',        'svg_path' => '/icons/fixtures/toilet.svg'],
            ['category' => 'Fixtures',   'label' => 'Sink',          'svg_path' => '/icons/fixtures/sink.svg'],
            ['category' => 'Fixtures',   'label' => 'Bathtub',       'svg_path' => '/icons/fixtures/bathtub.svg'],
            ['category' => 'Fixtures',   'label' => 'Shower',        'svg_path' => '/icons/fixtures/shower.svg'],
            ['category' => 'Office',     'label' => 'Office Chair',  'svg_path' => '/icons/office/office-chair.svg'],
            ['category' => 'Office',     'label' => 'Monitor',       'svg_path' => '/icons/office/monitor.svg'],
            ['category' => 'Office',     'label' => 'Filing Cabinet', 'svg_path' => '/icons/office/filing-cabinet.svg'],
            ['category' => 'Office',     'label' => 'Whiteboard',    'svg_path' => '/icons/office/whiteboard.svg'],
        ];

        foreach ($icons as $icon) {
            DB::table('icon_libraries')->updateOrInsert(
                ['user_id' => null, 'label' => $icon['label'], 'category' => $icon['category']],
                ['svg_path' => $icon['svg_path'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
