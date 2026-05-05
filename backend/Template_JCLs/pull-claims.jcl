//JOB10    JOB 1,NOTIFY=&SYSUID                                         JOB04507
//COPY     EXEC PGM=IEBGENER                                            00020001
//SYSIN    DD DUMMY
//SYSUT1   DD *
INPUT DATA RECORDS
//SYSUT2   DD SYSOUT=*
//SYSPRINT DD SYSOUT=*
//*
//SORT    EXEC PGM=SORT                                                 00020001
//SYSOUT  DD SYSOUT=*                                                   00030001
//SYSIN   DD *
  SORT FIELDS=(1,3,CH,A)
//SORTOUT DD SYSOUT=*
//SORTIN  DD *
1234546
ABCDEFG
!@#$%c\
/*
