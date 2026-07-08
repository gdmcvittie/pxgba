// plugins/MyImagePlugin/engine/src/my_effects.c
#include <gb/gb.h>

void my_native_effect_func() {
    // Example: Replace a tile at a specific location
    // This is a very basic "manipulation"
    unsigned char tile_x = 5; 
    unsigned char tile_y = 5;
    unsigned char new_tile_id = 120;

    set_bkg_tiles(tile_x, tile_y, 1, 1, &new_tile_id);
}