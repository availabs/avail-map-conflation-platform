# NOTES

## Handling centerline maps

When choosing matches for undirected TargetMaps,
  the chooser can determine bi-directionality using the matches
  and then choose for the reversed path as well.

  This will have the benefit of putting all undir/dir concern
    into the chooser... which is truly the only section of
    the code that cares. The rest of the repo stays oblivious.
