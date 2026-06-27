/*
 * Copyright (c) 2020-2026 Gustavo Valiente gustavo.valiente@protonmail.com
 * zlib License, see LICENSE file.
 */

#ifndef BN_HW_CORE_H
#define BN_HW_CORE_H

#include "bn_hw_tonc.h"

extern "C"
{
    void bn_hw_soft_reset(unsigned reset_flags);

    void bn_hw_hard_reset();
}

namespace bn::hw::core
{
    inline void init()
    {
        while(REG_VCOUNT != 160)
        {
        }

        while(REG_VCOUNT != 161)
        {
        }
    }

    inline void wait_for_vblank(volatile bool& flag)
    {
        constexpr int unsafe_scanlines = 10;

        BN_BARRIER;
        flag = true;
        BN_BARRIER;

        while(flag)
        {
            unsigned vcount = REG_VCOUNT;

            if(vcount >= 160 - unsafe_scanlines && vcount <= 160)
            {
                // vcount in unsafe range: active wait.
            }
            else
            {
                // vcount in safe range: bios wait.

                BN_BARRIER;

                if(flag)
                {
                    // flag can't be set to false after the check because we're in the safe range:
                    VBlankIntrWait();
                }

                // flag must be false at this point, avoid the last check:
                return;
            }
        }
    }

    inline void sleep()
    {
        Stop();
    }

    [[noreturn]] inline void reset()
    {
        bn_hw_soft_reset(0xFF);

        while(true)
        {
        }
    }

    [[noreturn]] inline void hard_reset()
    {
        bn_hw_hard_reset();

        while(true)
        {
        }
    }
}

#endif
