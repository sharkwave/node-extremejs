#!/usr/bin/perl
use strict;

while(<>) {
  if(/^\S/) {
    chomp;
    print "==$_==\n\n";
  }
  else {
    print "$_\n";
  }
}
