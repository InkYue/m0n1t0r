#include "init.h"
#include "error.h"
#include "vmaware.hpp"

bool init() { return VM::detect() == false; }
